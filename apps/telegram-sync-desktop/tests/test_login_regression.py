import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock,patch
from telethon import TelegramClient,errors,functions,types
from telethon.client.users import UserMethods
from telethon.sessions import StringSession
from local_app.engine import Engine,safe_error,telegram_client
from local_app.store import Store

class DatacenterRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def call_with_migration(self,client):
        client._loop=asyncio.get_running_loop()
        first=client._loop.create_future();first.set_exception(errors.PhoneMigrateError(request=None,capture=4))
        response=object();second=client._loop.create_future();second.set_result(response)
        sender=MagicMock();sender.send.side_effect=[first,second]
        request=functions.auth.SendCodeRequest('15555555555',123,'a'*32,types.CodeSettings())
        with patch.object(client,'is_user_authorized',new=AsyncMock(return_value=False)),patch.object(client,'_switch_dc',new=AsyncMock()) as switch:
            result=await UserMethods._call(client,sender,request)
        switch.assert_awaited_once_with(4)
        self.assertEqual(sender.send.call_count,2)
        self.assertIs(result,response)

    async def test_old_zero_retry_policy_reproduces_generic_failure(self):
        client=TelegramClient(StringSession(),123,'a'*32,request_retries=0)
        client._loop=asyncio.get_running_loop()
        first=client._loop.create_future();first.set_exception(errors.PhoneMigrateError(request=None,capture=4))
        sender=MagicMock();sender.send.return_value=first
        request=functions.auth.SendCodeRequest('15555555555',123,'a'*32,types.CodeSettings())
        with patch.object(client,'is_user_authorized',new=AsyncMock(return_value=False)),patch.object(client,'_switch_dc',new=AsyncMock()):
            with self.assertRaisesRegex(ValueError,'unsuccessful'):
                await UserMethods._call(client,sender,request)

    async def test_login_retries_after_required_datacenter_switch(self):
        client=telegram_client('',123,'a'*32,login=True)
        await self.call_with_migration(client)

    async def test_publishing_keeps_zero_automatic_retries(self):
        client=telegram_client('',123,'a'*32)
        self.assertEqual(client._request_retries,0)
        self.assertTrue(client._raise_last_call_error)

class LoginDiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=Store(Path(self.temp.name)/'local.sqlite3');self.engine=Engine(self.store)
    def tearDown(self):self.store.close();self.temp.cleanup()
    def fake(self):
        tg=MagicMock();tg.connect=AsyncMock();tg.disconnect=AsyncMock()
        tg.send_code_request=AsyncMock(return_value=SimpleNamespace(phone_code_hash='hash'))
        return tg
    async def test_normalizes_phone_and_uses_login_client(self):
        tg=self.fake()
        with patch('local_app.engine.telegram_client',return_value=tg) as factory:
            await self.engine.begin_login('123','a'*32,'+55 (11) 99999-9999')
        factory.assert_called_once_with('',123,'a'*32,login=True)
        tg.send_code_request.assert_awaited_once_with('+5511999999999')
    async def test_password_requested_without_code(self):
        tg=self.fake();tg.send_code_request.side_effect=errors.SessionPasswordNeededError(request=None)
        with patch('local_app.engine.telegram_client',return_value=tg):
            stage=await self.engine.begin_login('123','a'*32,'+5511999999999')
        self.assertEqual(stage,'password');self.assertTrue(self.engine.pending_login['needs_password'])
    async def test_failed_send_preserves_original_error_even_if_cleanup_fails(self):
        tg=self.fake();tg.send_code_request.side_effect=errors.ApiIdInvalidError(request=None);tg.disconnect.side_effect=OSError('cleanup')
        with patch('local_app.engine.telegram_client',return_value=tg):
            with self.assertRaises(errors.ApiIdInvalidError):
                await self.engine.begin_login('123','a'*32,'+5511999999999')
    def test_specific_errors_do_not_expose_request_data(self):
        reason=errors.ApiIdInvalidError(request=SimpleNamespace(phone='private-phone',api_hash='private-hash'))
        message=safe_error(reason)
        self.assertIn('API ID',message);self.assertNotIn('private-phone',message);self.assertNotIn('private-hash',message)
    def test_unknown_error_identifier_without_raw_message(self):
        message=safe_error(ValueError('private credentials'))
        self.assertIn('[ValueError]',message);self.assertNotIn('private credentials',message)
    def test_network_and_flood_diagnostics(self):
        self.assertIn('[TimeoutError]',safe_error(TimeoutError('private')))
        self.assertIn('[ConnectionError]',safe_error(ConnectionError('private')))
        self.assertIn('20 segundos',safe_error(errors.FloodWaitError(request=None,capture=20)))
