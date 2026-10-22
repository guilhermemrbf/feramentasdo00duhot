"""Real Tk integration checks: counters, filters and guarded actions; no Telegram access."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock
import tkinter as tk
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
        self.window.closing=True;self.window.runtime.close();self.window.runtime.thread.join(timeout=10)
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

    def test_navigation_and_task_form_do_not_send(self):
        for page in ('home','tasks','editor','rules','activity'):
            self.window.navigate(page);self.root.update()
            self.assertEqual(self.window.tabs.select(),str(self.window.pages[page]))
        self.window.new_task();self.root.update()
        self.assertTrue(self.window.task_dialog.winfo_exists())
        self.window.task_dialog.destroy()
        self.window.runtime.engine.connected.assert_not_awaited()
        self.assertEqual(len(self.store.jobs()),1)

    def test_busy_state_prevents_new_actions(self):
        self.window.busy=True;self.window.update_buttons()
        self.assertEqual(str(self.window.editor_tab.apply_button['state']),'disabled')
        self.assertEqual(str(self.window.editor_tab.scan_button['state']),'disabled')
        self.assertEqual(str(self.window.next_button['state']),'disabled')
        self.assertEqual(str(self.window.connect_button['state']),'disabled')

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
        editor.state_filter.set('Editadas');self.root.update()
        self.assertEqual(editor.tree.get_children(),('7',))
        self.assertIn('1 de 2',editor.progress_text.get())
        self.assertEqual(str(editor.restore_button['state']),'normal')
        editor.editor.db.patch(batch,status='incomplete');editor.refresh_progress()
        self.assertEqual(str(editor.apply_button['state']),'disabled')

    def test_narrow_window_keeps_sidebar_and_scrollable_pages(self):
        self.root.geometry('980x640');self.root.deiconify()
        for key in ('home','tasks','editor','rules','activity'):
            self.window.navigate(key);self.root.update()
            page=self.window.pages[key]
            self.assertGreater(page.canvas.winfo_width(),600)
            self.assertGreater(page.canvas.winfo_height(),400)
            self.assertGreater(page.canvas.bbox('all')[3],page.canvas.winfo_height())
            page.canvas.yview_moveto(1);self.root.update()
        self.window.runtime.engine.connected.assert_not_awaited()
