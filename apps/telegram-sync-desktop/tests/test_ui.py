"""Tk checks for the editor-only app, using temporary data and no Telegram access."""
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
        self.job=self.store.create('1','2','Registro antigo','Destino antigo','history',[],100)
        self.root=tk.Tk();self.root.withdraw();self.errors=[]
        self.root.report_callback_exception=lambda *args:self.errors.append(args)
        self.network_patch=patch('local_app.runtime.Engine.connected',new=AsyncMock(side_effect=AssertionError('UI must not connect automatically')))
        self.connected=self.network_patch.start()
        self.window=Window(self.root,self.store);self.root.update()
        self.original_job=self.store.job(self.job)

    def tearDown(self):
        self.window.closing=True
        for timer in (self.window.poll_id,self.window.tick_id):self.root.after_cancel(timer)
        self.window.runtime.close();self.window.runtime.thread.join(timeout=10)
        self.assertFalse(self.window.runtime.thread.is_alive())
        self.store.close();self.root.destroy();self.temp.cleanup();self.network_patch.stop()
        self.assertEqual(self.errors,[])

    def widgets(self,widget=None):
        widget=self.root if widget is None else widget
        return [widget]+[child for inner in widget.winfo_children() for child in self.widgets(inner)]

    def batch(self,messages=(7,8)):
        editor=self.window.editor_tab
        original={'text':'VIP','entities':encode_entities([types.MessageEntityTextUrl(0,3,'https://old.example')]),'media':None,'preview':False,'buttons':None}
        desired,links=rewrite(original,DEFAULT_URL)
        batch=editor.editor.db.create('-100123','Canal de teste',1,DEFAULT_URL)
        for message in messages:editor.editor.db.add(batch,message,original,desired,links)
        editor.editor.db.patch(batch,status='ready',scanned=200)
        editor.complete(batch)
        return batch

    def test_editor_is_the_only_screen_and_startup_never_connects(self):
        self.root.deiconify();self.root.update()
        self.assertEqual(self.window.active_page,'editor')
        self.assertTrue(self.window.editor_tab.frame.winfo_ismapped())
        widgets=self.widgets()
        self.assertFalse(any(isinstance(widget,(tk.Toplevel,ttk.Notebook,ttk.Radiobutton)) for widget in widgets))
        texts=[str(widget.cget('text')).casefold() for widget in widgets if isinstance(widget,(ttk.Button,ttk.Label))]
        for removed in ('copiar','automação','encaminhar','sincronizações'):
            self.assertFalse(any(removed in text for text in texts),removed)
        for removed in ('copy_panel','copy_method','jobs','rules_section','automation_tab','create','control','show_operation'):
            self.assertFalse(hasattr(self.window,removed),removed)
        self.assertEqual(self.original_job['status'],'cancelled')
        self.connected.assert_not_awaited()

    def test_reading_history_and_navigation_preserves_old_records(self):
        self.window.navigate('activity');self.root.update()
        self.assertTrue(self.window.activity_section.opened)
        self.window.navigate('editor');self.window.reload();self.root.update()
        self.assertEqual(self.window.active_page,'editor')
        self.assertEqual(self.store.job(self.job),self.original_job)
        self.connected.assert_not_awaited()

    def test_busy_state_blocks_new_actions_and_keeps_editor_pause_available(self):
        editor=self.window.editor_tab;editor.operation='apply'
        editor.editor.cancel.clear();self.window.busy=True;self.window.update_buttons()
        for button in (editor.apply_button,editor.scan_button,editor.channels_button,self.window.connect_button):
            self.assertEqual(str(button['state']),'disabled')
        self.assertEqual(str(editor.stop_button['state']),'normal')
        editor.stop_button.invoke()
        self.assertTrue(editor.editor.cancel.is_set())
        self.assertIn('Pausa solicitada',self.window.status.get())
        self.window.busy=False

    def test_live_editor_counters_filters_and_backup_preview(self):
        editor=self.window.editor_tab;batch=self.batch()
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

    def test_dashboard_and_analyze_action_fit_at_980_by_640(self):
        self.root.geometry('980x640');self.root.deiconify();self.root.update()
        self.window.navigate('editor');self.root.update()
        action=self.window.editor_tab.scan_button
        self.assertLessEqual(action.winfo_rooty()+action.winfo_height(),self.window.page.canvas.winfo_rooty()+self.window.page.canvas.winfo_height())
        metric=self.window.edit_metrics['pending'].frame;y=metric.winfo_rooty()
        self.window.page.canvas.yview_moveto(1);self.root.update()
        self.assertEqual(metric.winfo_rooty(),y)
        self.assertTrue(metric.winfo_ismapped())
        self.assertGreater(self.window.page.canvas.winfo_width(),900)
        self.assertGreater(self.window.page.canvas.winfo_height(),250)
        self.connected.assert_not_awaited()

    def test_editor_applies_all_posts_despite_selection_and_filters(self):
        editor=self.window.editor_tab;batch=self.batch()
        editor.tree.selection_set('7');editor.search.set('7');self.root.update()
        self.assertIn('2 pendentes',editor.link_summary.get())
        with patch('local_app.editor_ui.messagebox.askyesno',return_value=True),patch.object(self.window,'dispatch',side_effect=lambda coro,callback:coro.close()),patch.object(editor.editor,'apply',new=AsyncMock()) as apply:
            editor.apply()
            apply.assert_called_once_with(batch,False,None)
        self.assertEqual(editor.run_ids,{7,8});self.assertEqual(editor.run_total,2)
        self.window.busy=True
        editor.editor.db.patch(batch,status='applying',note='Alterando post 8')
        editor.editor.db.item_state(batch,7,'applied');editor.refresh_progress()
        self.assertIn('1 alterados',editor.link_summary.get())
        self.assertEqual(editor.live_note.get(),'Alterando post 8')
        self.assertIn('1 de 2',editor.progress_text.get())
        self.window.busy=False

    def test_declining_apply_confirmation_changes_nothing(self):
        editor=self.window.editor_tab;batch=self.batch()
        with patch('local_app.editor_ui.messagebox.askyesno',return_value=False),patch.object(self.window,'dispatch') as dispatch:
            editor.apply();dispatch.assert_not_called()
        self.assertEqual([row['status'] for row in editor.editor.db.states(batch)],['pending','pending'])

    def test_optional_history_and_backup_controls_start_closed(self):
        for fold in (self.window.activity_section,self.window.editor_tab.backups,self.window.editor_tab.filters):
            self.assertFalse(fold.opened);self.assertEqual(fold.body.winfo_manager(),'')
            fold.flip();self.root.update();self.assertTrue(fold.opened);fold.flip()
        self.assertEqual(self.store.job(self.job),self.original_job)
        self.connected.assert_not_awaited()

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
        self.connected.assert_not_awaited()

    def test_changed_editor_inputs_require_new_preview_before_applying(self):
        editor=self.window.editor_tab;batch=self.batch((7,))
        self.assertEqual(str(editor.apply_button['state']),'normal')
        editor.target.set('https://t.me/new_target');self.root.update()
        self.assertEqual(str(editor.apply_button['state']),'disabled')
        self.assertEqual(editor.apply_button.winfo_manager(),'')
        with patch.object(self.window,'notify') as notice,patch.object(self.window,'dispatch') as dispatch:
            editor.apply();dispatch.assert_not_called();self.assertIn('nova prévia',notice.call_args.args[0])
        self.assertEqual(editor.editor.db.states(batch)[0]['status'],'pending')
        editor.target.set(DEFAULT_URL);self.root.update()
        self.assertEqual(str(editor.apply_button['state']),'normal')

    def test_runtime_error_releases_busy_state_without_starting_other_work(self):
        self.window.busy=True;self.window.update_buttons()
        self.window.runtime.events.put(('error','Falha de teste',None))
        self.root.after_cancel(self.window.poll_id)
        with patch('local_app.ui.messagebox.showerror') as error:self.window.poll()
        self.assertFalse(self.window.busy)
        self.assertEqual(str(self.window.editor_tab.scan_button['state']),'normal')
        error.assert_called_once()
        self.assertEqual(self.store.job(self.job),self.original_job)
        self.connected.assert_not_awaited()

    def test_close_respects_decline_then_cancels_editor_and_stops_runtime(self):
        self.window.busy=True;self.window.runtime.engine.editor.cancel.clear()
        with patch('local_app.ui.messagebox.askyesno',return_value=False):self.window.close()
        self.assertFalse(self.window.closing)
        self.assertFalse(self.window.runtime.closed)
        self.assertFalse(self.window.runtime.engine.editor.cancel.is_set())
        with patch('local_app.ui.messagebox.askyesno',return_value=True),patch.object(self.root,'after',return_value='test-close'):
            self.window.close()
        self.assertTrue(self.window.closing)
        self.assertTrue(self.window.runtime.engine.editor.cancel.is_set())
        self.window.runtime.thread.join(timeout=10)
        self.assertFalse(self.window.runtime.thread.is_alive())
        self.assertTrue(self.root.winfo_exists())
        self.connected.assert_not_awaited()
