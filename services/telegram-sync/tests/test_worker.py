import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from types import SimpleNamespace
import app

class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def simulate(self, prior=None, fail=False):
        job={'id':'job','connection_id':'connection','user_id':'owner','source':'source','destination':'destination','mode':'history','until_id':1,'checkpoint':0,'rules':[]}
        statements=[]
        def execute(sql, params=None):
            statements.append((sql,params))
            if sql.startswith('select * from tg_sync_jobs'): value=job
            elif 'pg_try_advisory' in sql: value={'ok':True}
            elif sql.startswith('select * from tg_connections'): value={'session_ciphertext':'encrypted'}
            elif sql.startswith('select state'): value=prior
            else: value=None
            result=MagicMock(); result.fetchone.return_value=value
            return result
        conn=MagicMock(); conn.execute.side_effect=execute
        message=SimpleNamespace(id=1,grouped_id=None,media=None,message='Hello',get_entities_text=lambda:[])
        async def messages(*args,**kwargs): yield message
        tg=MagicMock(); tg.connect=AsyncMock(); tg.disconnect=AsyncMock(); tg.iter_messages=messages
        tg.send_message=AsyncMock(side_effect=TimeoutError() if fail else None,return_value=SimpleNamespace(id=10))
        with patch.object(app,'db') as db, patch.object(app,'client',return_value=tg), patch.object(app,'cipher') as cipher, patch.object(app,'pair',new=AsyncMock(return_value=('src','dst'))):
            db.return_value.__enter__.return_value=conn
            cipher.return_value.decrypt.return_value=b'session'
            await app.tick()
        return tg,statements

    async def test_sends_and_records_mapping(self):
        tg,sql=await self.simulate()
        tg.send_message.assert_awaited_once()
        insert=next(i for i,(s,p) in enumerate(sql) if s.startswith('insert into tg_message_map'))
        confirm=next(i for i,(s,p) in enumerate(sql) if s.startswith('update tg_message_map'))
        self.assertLess(insert,confirm)
        self.assertTrue(any(s.startswith('update tg_sync_jobs set checkpoint') for s,p in sql))

    async def test_unknown_previous_send_never_resends(self):
        tg,sql=await self.simulate({'state':'sending'})
        tg.send_message.assert_not_awaited()
        self.assertTrue(any("status='attention'" in s for s,p in sql))
        self.assertFalse(any(s.startswith('update tg_sync_jobs set checkpoint') for s,p in sql))

    async def test_confirmed_send_is_not_repeated(self):
        tg,sql=await self.simulate({'state':'sent'})
        tg.send_message.assert_not_awaited()
        self.assertTrue(any(s.startswith('update tg_sync_jobs set checkpoint') for s,p in sql))

    async def test_network_failure_requires_review(self):
        tg,sql=await self.simulate(fail=True)
        self.assertTrue(any("status='attention'" in s for s,p in sql))
        self.assertFalse(any(s.startswith('update tg_sync_jobs set checkpoint') for s,p in sql))
