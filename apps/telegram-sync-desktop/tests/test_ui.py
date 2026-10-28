"""Real Tk integration checks: counters, filters and guarded actions; no Telegram access."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
import tkinter as tk
from tkinter import ttk
from local_app.store import Store
from local_app.ui import Window
from local_app.editor import DEFAULT_URL, encode_entities, rewrite
from telethon import types


@unittest.skipUnless(os.name=='nt' or os.environ.get('DISPLAY'),'Requires a graphical display')
class InterfaceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=Store(Path(self.temp.name)/'fixture.sqlite3')
        self.job=self.store.create('1','2','Cursos de teste','Destino de teste','history',[],100)
        self.store.reserve(self.job,[1,2]);self.store.confirm(self.job,[1,2],[101,102])
        self.store.reserve(self.job,[3,4,5]);self.store.confirm(self.job,[3,4,5],[])
        self.store.reserve(self.job,[6]);self.store.patch(self.job,status='attention')
        self.root=tk.Tk();self.root.withdraw();self.errors=[]
        self.root.report_callback_exception=lambda *args:self.errors.append(args)
        self.window=Window(self.root,self.store)
        self.window.runtime.engine.connected=AsyncMock(side_effect=AssertionError('UI must not connect automatically'))
        self.root.update()
    def tearDown(self):
        self.window.closing=True
        for timer in (self.window.poll_id,self.window.tick_id):self.root.after_cancel(timer)
        self.window.runtime.close();self.window.runtime.thread.join(timeout=10)
        self.assertFalse(self.window.runtime.thread.is_alive())
        self.store.close();self.root.destroy();self.temp.cleanup()
        self.assertEqual(self.errors,[])

    def test_published_count_excludes_skipped_and_unconfirmed(self):
        self.assertEqual(self.window.home_metrics['sent'].value.get(),'2')
        row=self.window.jobs.item(str(self.job),'values')
        self.assertEqual(row[-2:],('2','1'))
        self.window.jobs.selection_set(str(self.job));self.window.details()
        self.assertIn('3 ignoradas',self.window.detail.get())
        self.assertIn('1 sem confirmação',self.window.detail.get())
        self.assertEqual(str(self.window.start_button['state']),'disabled')
        self.assertEqual(str(self.window.recover_button['state']),'normal')

    def test_filter_and_search_preserve_original_task(self):
        self.window.task_filter.set('Pausadas');self.root.update()
        self.assertEqual(self.window.jobs.get_children(),())
        self.window.task_filter.set('Todas');self.window.search.set('cursos');self.root.update()
        self.assertEqual(self.window.jobs.get_children(),(str(self.job),))
        self.window.search.set('não existe');self.root.update()
        self.assertEqual(self.window.jobs.get_children(),())
        self.assertEqual(self.store.job(self.job)['status'],'attention')

    def test_one_screen_and_inline_form_do_not_send(self):
        self.root.deiconify();self.root.update()
        def widgets(widget):
            return [widget]+[child for inner in widget.winfo_children() for child in widgets(inner)]
        self.assertFalse(any(isinstance(widget,(tk.Toplevel,ttk.Notebook)) for widget in widgets(self.root)))
        for operation in ('copy','edit','copy'):
            self.window.show_operation(operation);self.root.update()
            self.assertEqual(self.window.operation_choice.get(),operation)
            self.assertEqual(bool(self.window.copy_panel.winfo_manager()),operation=='copy')
            self.assertEqual(bool(self.window.editor_tab.frame.winfo_manager()),operation=='edit')
        self.window.new_task();self.root.update()
        self.assertIsNone(self.window.task_dialog)
        self.assertTrue(self.window.copy_form.winfo_ismapped())
        self.window.runtime.engine.connected.assert_not_awaited()
        self.assertEqual(len(self.store.jobs()),1)

    def test_busy_state_prevents_new_actions(self):
        self.window.busy=True;self.window.update_buttons()
        self.assertEqual(str(self.window.editor_tab.apply_button['state']),'disabled')
        self.assertEqual(str(self.window.editor_tab.scan_button['state']),'disabled')
        self.assertEqual(str(self.window.create_button['state']),'disabled')
        self.assertEqual(str(self.window.connect_button['state']),'disabled')

    def test_native_copy_defaults_and_picker_select_without_network_or_send(self):
        self.assertEqual(self.window.copy_method.get(),'forward100')
        self.assertEqual(str(self.window.rules_section.toggle['state']),'disabled')
        self.window.channel_picker(self.window.source,[{'id':'-100123','title':'Origem de teste'}])
        dialog=next(widget for widget in self.root.winfo_children() if isinstance(widget,tk.Toplevel))
        def descendants(widget):
            return [widget]+[child for inner in widget.winfo_children() for child in descendants(inner)]
        tree=next(widget for widget in descendants(dialog) if isinstance(widget,ttk.Treeview))
        tree.selection_set('-100123')
        next(widget for widget in descendants(dialog) if isinstance(widget,ttk.Button) and str(widget['text'])=='Selecionar').invoke()
        self.assertEqual(self.window.source.get(),'-100123')
        self.window.runtime.engine.connected.assert_not_awaited()
        self.window.copy_method.set('rewrite');self.window.copy_method_changed()
        self.assertEqual(str(self.window.rules_section.toggle['state']),'normal')

    def test_live_editor_counters_filters_and_backup_preview(self):
        editor=self.window.editor_tab
        original={'text':'VIP','entities':encode_entities([types.MessageEntityTextUrl(0,3,'https://old.example')]),'media':None,'preview':False,'buttons':None}
        desired,links=rewrite(original,DEFAULT_URL)
        batch=editor.editor.db.create('-100123','Canal de teste',1,DEFAULT_URL)
        for message in (7,8):editor.editor.db.add(batch,message,original,desired,links)
        editor.editor.db.patch(batch,status='ready',scanned=200)
        editor.complete(batch)
        self.assertEqual(editor.stats['pending'].value.get(),'2')
        self.assertEqual(str(editor.apply_button['state']),'normal')
        editor.tree.selection_set('7');editor.details()
        self.assertIn(DEFAULT_URL,editor.detail.get('1.0','end'))
        self.assertIn('https://old.example',editor.original_text.get('1.0','end'))
        editor.editor.db.item_state(batch,7,'applied');editor.refresh_progress()
        self.assertEqual(editor.stats['pending'].value.get(),'1')
        self.assertEqual(editor.stats['applied'].value.get(),'1')
        self.assertEqual(self.window.edit_metrics['applied'].value.get(),'1')
        editor.state_filter.set('Editadas');self.root.update()
        self.assertEqual(editor.tree.get_children(),('7',))
        self.assertIn('1 de 2',editor.progress_text.get())
        self.assertEqual(str(editor.restore_button['state']),'normal')
        editor.editor.db.patch(batch,status='incomplete');editor.refresh_progress()
        self.assertEqual(str(editor.apply_button['state']),'disabled')

    def test_dashboard_stays_visible_when_scrolling_at_980_by_640(self):
        self.root.geometry('980x640');self.root.deiconify();self.root.update()
        for operation in ('copy','edit'):
            self.window.show_operation(operation);self.window.page.canvas.yview_moveto(0);self.root.update()
            action=self.window.create_button if operation=='copy' else self.window.editor_tab.scan_button
            self.assertLessEqual(action.winfo_rooty()+action.winfo_height(),self.window.page.canvas.winfo_rooty()+self.window.page.canvas.winfo_height())
            metric=(self.window.home_metrics['sent'] if operation=='copy' else self.window.edit_metrics['pending']).frame
            y=metric.winfo_rooty()
            self.window.page.canvas.yview_moveto(1);self.root.update()
            self.assertEqual(metric.winfo_rooty(),y)
            self.assertTrue(metric.winfo_ismapped())
            self.assertGreater(self.window.page.canvas.winfo_width(),900)
            self.assertGreater(self.window.page.canvas.winfo_height(),250)
            self.assertGreater(self.window.page.canvas.bbox('all')[3],self.window.page.canvas.winfo_height())
        self.window.runtime.engine.connected.assert_not_awaited()

    def test_editor_applies_all_posts_despite_selection_and_filters(self):
        editor=self.window.editor_tab
        original={'text':'VIP','entities':encode_entities([types.MessageEntityTextUrl(0,3,'https://old.example')]),'media':None,'preview':False,'buttons':None}
        desired,links=rewrite(original,DEFAULT_URL)
        batch=editor.editor.db.create('-100123','Canal de teste',1,DEFAULT_URL)
        for message in (7,8):editor.editor.db.add(batch,message,original,desired,links)
        editor.editor.db.patch(batch,status='ready',scanned=2);editor.complete(batch)
        editor.tree.selection_set('7');editor.search.set('7');self.root.update()
        self.assertIn('2 pendentes',editor.link_summary.get())
        with patch('local_app.editor_ui.messagebox.askyesno',return_value=True),patch.object(self.window,'dispatch',side_effect=lambda coro,callback:coro.close()),patch.object(editor.editor,'apply',new=AsyncMock()) as apply:
            editor.apply()
            apply.assert_called_once_with(batch,False,None)
        self.assertEqual(editor.run_ids,{7,8})
        self.assertEqual(editor.run_total,2)
        self.window.busy=True
        editor.editor.db.patch(batch,status='applying',note='Alterando post 8')
        editor.editor.db.item_state(batch,7,'applied');editor.refresh_progress()
        self.assertIn('1 alterados',editor.link_summary.get())
        self.assertEqual(editor.live_note.get(),'Alterando post 8')
        self.assertIn('1 de 2',editor.progress_text.get())
        self.window.busy=False

    def test_optional_controls_start_closed_and_do_not_change_data(self):
        for fold in (self.window.copy_options,self.window.rules_section,self.window.activity_section,self.window.task_extra,self.window.editor_tab.backups,self.window.editor_tab.filters):
            self.assertFalse(fold.opened);self.assertEqual(fold.body.winfo_manager(),'')
            fold.flip();self.root.update();self.assertTrue(fold.opened);fold.flip()
        self.assertEqual(self.window.mode.get(),'history');self.assertFalse(self.window.authorized.get())
        self.assertEqual(self.store.job(self.job)['status'],'attention')
        self.window.runtime.engine.connected.assert_not_awaited()

    def test_inline_login_shows_only_requested_code_or_password(self):
        self.window.login();self.root.update()
        self.assertEqual(self.window.login_dialog.winfo_toplevel(),self.root)
        self.assertEqual(self.window.login_rows['code'].winfo_manager(),'')
        self.assertEqual(self.window.login_rows['password'].winfo_manager(),'')
        def respond(stage):
            def dispatch(coro,callback):coro.close();callback(stage)
            return dispatch
        for stage in ('code','password'):
            with patch.object(self.window,'dispatch',side_effect=respond(stage)):
                self.window.login_step();self.root.update()
            self.assertEqual(bool(self.window.login_rows['code'].winfo_manager()),stage=='code')
            self.assertEqual(bool(self.window.login_rows['password'].winfo_manager()),stage=='password')
        with patch.object(self.window,'dispatch',side_effect=respond('connected')):
            self.window.login_step();self.root.update()
        self.assertIsNone(self.window.login_dialog)
        self.assertEqual(self.window.login_section.winfo_manager(),'')
        self.assertTrue(all(not value.get() for value in self.window.login_vars.values()))
        self.window.runtime.engine.connected.assert_not_awaited()

    def test_changed_editor_inputs_require_new_preview_before_applying(self):
        editor=self.window.editor_tab
        original={'text':'VIP','entities':encode_entities([types.MessageEntityTextUrl(0,3,'https://old.example')]),'media':None,'preview':False,'buttons':None}
        desired,links=rewrite(original,DEFAULT_URL)
        batch=editor.editor.db.create('-100123','Canal de teste',1,DEFAULT_URL)
        editor.editor.db.add(batch,7,original,desired,links)
        editor.editor.db.patch(batch,status='ready');editor.complete(batch)
        self.assertEqual(str(editor.apply_button['state']),'normal')
        editor.target.set('https://t.me/new_target');self.root.update()
        self.assertEqual(str(editor.apply_button['state']),'disabled')
        self.assertEqual(editor.apply_button.winfo_manager(),'')
        with patch.object(self.window,'notify') as notice,patch.object(self.window,'dispatch') as dispatch:
            editor.apply();dispatch.assert_not_called();self.assertIn('nova prévia',notice.call_args.args[0])
        self.assertEqual(editor.editor.db.states(batch)[0]['status'],'pending')
        editor.target.set(DEFAULT_URL);self.root.update()
        self.assertEqual(str(editor.apply_button['state']),'normal')

    def test_created_task_is_selected_and_paused_without_starting(self):
        self.window.authorized.set(True)
        job=self.store.create('10','20','Origem autorizada','Meu destino','history',[],100)
        self.window.task_created(job);self.root.update()
        self.assertEqual(self.window.jobs.selection(),(str(job),))
        self.assertEqual(self.store.job(job)['status'],'paused');self.assertFalse(self.window.authorized.get())
        self.assertEqual(str(self.window.start_button['state']),'normal')
        self.assertEqual(self.window.home_metrics['paused'].value.get(),'1')
        self.window.runtime.engine.connected.assert_not_awaited()
