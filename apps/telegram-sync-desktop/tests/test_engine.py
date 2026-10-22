import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock,patch
from telethon import errors
from local_app.engine import Engine,safe_error
from local_app.store import Store
from local_app.domain import UserError
class EngineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=Store(Path(self.temp.name)/'test.sqlite3');self.engine=Engine(self.store)
    def tearDown(self):self.store.close();self.temp.cleanup()
    async def run_batch(self,fail=None,prior=False):
        job=self.store.create('1','2','A','B','history',[],1);self.store.control(job,'start')
        if prior:self.store.reserve(job,[1])
        message=SimpleNamespace(id=1,grouped_id=None,media=None,message='hello',get_entities_text=lambda:[])
        async def messages(*args,**kwargs):yield message
        tg=MagicMock();tg.iter_messages=messages;tg.send_message=AsyncMock(side_effect=fail,return_value=SimpleNamespace(id=10))
        with patch.object(self.engine,'connected',new=AsyncMock(return_value=tg)),patch.object(self.engine,'pair',new=AsyncMock(return_value=('src','dst'))),patch('local_app.engine.asyncio.sleep',new=AsyncMock()):
            await self.engine.process(self.store.job(job))
        return job,tg
    async def test_send_and_complete(self):
        job,tg=await self.run_batch();tg.send_message.assert_awaited_once()
        self.assertEqual(self.store.job(job)['status'],'completed');self.assertEqual(self.store.job(job)['checkpoint'],1)
    async def test_timeout_no_checkpoint(self):
        with self.assertRaises(TimeoutError):await self.run_batch(fail=TimeoutError('secret'))
        job=self.store.jobs()[0];self.assertEqual(self.store.pending(job['id']),[1]);self.assertEqual(job['checkpoint'],0)
        self.assertNotIn('secret',safe_error(TimeoutError('secret')))
    async def test_no_ambiguous_resend(self):
        with self.assertRaises(UserError):await self.run_batch(prior=True)
        self.assertEqual(self.store.jobs()[0]['checkpoint'],0)
    async def test_floodwait_releases_reservation(self):
        job,tg=await self.run_batch(fail=errors.FloodWaitError(request=None,capture=10))
        self.assertEqual(self.store.pending(job),[]);self.assertEqual(self.store.job(job)['checkpoint'],0)
        self.assertEqual(self.store.job(job)['status'],'running')
    async def test_permission_before_reservation(self):
        job=self.store.create('1','2','A','B','history',[],1);self.store.control(job,'start')
        with patch.object(self.engine,'connected',new=AsyncMock(return_value=MagicMock())),patch.object(self.engine,'pair',new=AsyncMock(side_effect=UserError('Sem permissão'))):
            with self.assertRaises(UserError):await self.engine.process(self.store.job(job))
        self.assertEqual(self.store.pending(job),[])
    async def test_authorization_before_network(self):
        with patch.object(self.engine,'connected',new=AsyncMock()) as connected:
            with self.assertRaises(UserError):await self.engine.create('1','2','history',[],False)
            connected.assert_not_awaited()
    async def test_redacted_error(self):self.assertNotIn('123456',safe_error(Exception('phone 123456 secret')))
    async def test_shutdown(self):
        tg=MagicMock();tg.disconnect=AsyncMock();self.engine.client=tg
        await self.engine.shutdown();tg.disconnect.assert_awaited_once()
