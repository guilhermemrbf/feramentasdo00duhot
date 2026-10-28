import tempfile
import unittest
from pathlib import Path
from local_app.store import Store
from local_app.domain import UserError

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'local.sqlite3';self.store=Store(self.path)
    def tearDown(self):self.store.close();self.temp.cleanup()
    def create(self,source='1',destination='2'):
        return self.store.create(source,destination,'Origem','Destino','history',[],100)
    def test_paused_on_reopen(self):
        job=self.create();self.store.control(job,'start');self.store.close();self.store=Store(self.path)
        self.assertEqual(self.store.job(job)['status'],'paused')
    def test_crash_album_requires_review(self):
        job=self.create();self.store.control(job,'start');self.store.reserve(job,[1,2,3]);self.store.close();self.store=Store(self.path)
        self.assertEqual(self.store.job(job)['status'],'attention');self.assertEqual(self.store.pending(job),[1,2,3])
        with self.assertRaises(UserError):self.store.control(job,'start')
        self.assertEqual(self.store.job(job)['checkpoint'],0)
    def test_album_confirmation(self):
        job=self.create();self.assertTrue(self.store.reserve(job,[1,2]));self.store.confirm(job,[1,2],[10,11])
        self.assertFalse(self.store.reserve(job,[1,2]));self.assertEqual(self.store.job(job)['checkpoint'],2)
        self.assertEqual(self.store.job(job)['processed'],2)
    def test_partial_response_remains_pending(self):
        job=self.create();self.store.reserve(job,[1,2])
        with self.assertRaises(UserError):self.store.confirm(job,[1,2],[10])
        self.assertEqual(self.store.pending(job),[1,2]);self.assertEqual(self.store.job(job)['checkpoint'],0)
    def test_manual_confirmation_no_fabricated_ids(self):
        job=self.create();self.store.reserve(job,[1,2]);self.store.patch(job,status='attention');self.store.resolve_pending(job,'sent')
        self.assertEqual(self.store.job(job)['checkpoint'],2);self.assertEqual(self.store.job(job)['status'],'paused')
        row=self.store.conn.execute('select destination_ids from messages where job_id=?',(job,)).fetchone()
        self.assertEqual(row['destination_ids'],'[]')
    def test_retry_keeps_checkpoint(self):
        job=self.create();self.store.reserve(job,[1]);self.store.patch(job,status='attention');self.store.resolve_pending(job,'retry')
        self.assertEqual(self.store.pending(job),[]);self.assertEqual(self.store.job(job)['checkpoint'],0)
        self.assertTrue(self.store.reserve(job,[1]))
    def test_cycle_duplicate_and_account_guard(self):
        self.create();self.create('2','3')
        with self.assertRaises(UserError):self.create('3','1')
        with self.assertRaises(UserError):self.create()
        with self.assertRaises(UserError):self.store.clear_account()
    def test_floodwait(self):
        job=self.create();self.store.reserve(job,[1,2]);self.store.defer(job,[1,2],10)
        self.assertEqual(self.store.pending(job),[]);self.assertTrue(self.store.reserve(job,[1,2]))
        self.assertGreater(self.store.job(job)['next_run'],0)
    def test_invalid_mutations(self):
        job=self.create()
        with self.assertRaises(ValueError):self.store.patch(job,source='3')
        with self.assertRaises(UserError):self.store.create('3','4','x','y','history',[{'find':'','replacement':'x'}],0)

    def test_forward_selection_rejects_more_than_100_rules_continuous_and_duplicate_ids(self):
        for mode,rules,ids in [('history',[],list(range(1,102))),('continuous',[],[1]),('history',[{'find':'a','replacement':'b'}],[1]),('history',[],[1,1]),('history',[],[])]:
            with self.assertRaises(UserError):self.store.create('1','2','A','B',mode,rules,101,'forward100',ids)

    def test_legacy_jobs_keep_method_rules_and_checkpoint_after_column_migration(self):
        job=self.create();self.store.patch(job,checkpoint=42)
        self.store.conn.execute('alter table jobs drop column copy_method')
        self.store.conn.execute('alter table jobs drop column selection');self.store.conn.commit()
        self.store.close();self.store=Store(self.path)
        saved=self.store.job(job)
        self.assertEqual(saved['copy_method'],'rewrite');self.assertEqual(saved['selection'],'[]')
        self.assertEqual(saved['checkpoint'],42);self.assertEqual(saved['rules'],'[]')
    def test_retry_before_side_effect(self):
        job=self.create();self.store.patch(job,status='attention',error='Permissão');self.store.control(job,'start')
        self.assertEqual(self.store.job(job)['status'],'running')
