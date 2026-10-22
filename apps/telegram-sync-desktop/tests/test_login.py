import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock,patch
from telethon import errors
from local_app.engine import Engine
from local_app.store import Store

class LoginTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=Store(Path(self.temp.name)/'local.sqlite3');self.engine=Engine(self.store)
    def tearDown(self):self.store.close();self.temp.cleanup()
    def fake(self):
        tg=MagicMock();tg.connect=AsyncMock();tg.disconnect=AsyncMock();tg.send_code_request=AsyncMock(return_value=SimpleNamespace(phone_code_hash='code-hash'))
        tg.sign_in=AsyncMock();tg.is_user_authorized=AsyncMock(return_value=True);tg.get_me=AsyncMock(return_value=SimpleNamespace(first_name='User',bot=False));tg.session.save.return_value='secret-session'
        return tg
    async def test_otp_is_not_persisted(self):
        tg=self.fake()
        with patch('local_app.engine.TelegramClient',return_value=tg),patch('local_app.engine.protect',side_effect=lambda value:'sealed:'+value):
            self.assertEqual(await self.engine.begin_login('123','a'*32,'+5511999999999'),'code')
            self.assertEqual(await self.engine.finish_login(code='12345'),'connected')
        value=self.store.setting('account')
        self.assertNotIn('12345',value);self.assertNotIn('code-hash',value);self.assertNotIn('+5511',value)
        self.assertIn('secret-session',value) # Fake protector for this unit test only.
        self.assertIsNone(self.engine.pending_login)
    async def test_two_factor_flow(self):
        tg=self.fake();tg.sign_in.side_effect=[errors.SessionPasswordNeededError(request=None),None]
        with patch('local_app.engine.TelegramClient',return_value=tg),patch('local_app.engine.protect',return_value='sealed'):
            await self.engine.begin_login('123','a'*32,'+5511999999999')
            self.assertEqual(await self.engine.finish_login(code='12345'),'password')
            self.assertEqual(await self.engine.finish_login(password='sensitive-2fa'),'connected')
        self.assertEqual(self.store.setting('account'),'sealed')
        tg.sign_in.assert_awaited_with(password='sensitive-2fa')
    async def test_aborted_login_disconnects(self):
        tg=self.fake()
        with patch('local_app.engine.TelegramClient',return_value=tg):
            await self.engine.begin_login('123','a'*32,'+5511999999999');await self.engine.abort_login()
        tg.disconnect.assert_awaited_once();self.assertIsNone(self.engine.pending_login)
        self.assertEqual(self.store.setting('account'),'')
