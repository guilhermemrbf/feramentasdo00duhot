import unittest
import uuid
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException
from cryptography.fernet import Fernet
import app

class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_bearer(self):
        with self.assertRaises(HTTPException) as ctx: await app.owner(None)
        self.assertEqual(ctx.exception.status_code,401)

    async def test_cross_user_connection(self):
        database=MagicMock(); database.execute.return_value.fetchone.return_value=None
        with patch.object(app,'db') as db, patch.object(app,'client') as tg:
            db.return_value.__enter__.return_value=database
            with self.assertRaises(HTTPException) as ctx:
                await app.action('user-a',app.Command(action='resolve',id=uuid.uuid4(),source='@channel1',destination='@channel2'))
            self.assertEqual(ctx.exception.status_code,404)
            tg.assert_not_called()
            self.assertIn('user_id=%s',database.execute.call_args.args[0])

    async def test_attention_cannot_resume(self):
        database=MagicMock(); database.execute.return_value.fetchone.return_value={'status':'attention'}
        with patch.object(app,'db') as db:
            db.return_value.__enter__.return_value=database
            with self.assertRaises(ValueError):
                await app.action('user-a',app.Command(action='resume',id=uuid.uuid4()))

    async def test_protected_channel(self):
        from telethon import types
        protected=types.Chat(id=123,title='Protected',photo=types.ChatPhotoEmpty(),participants_count=1,date=None,version=1,noforwards=True)
        tg=MagicMock(); tg.get_entity=AsyncMock(return_value=protected)
        with self.assertRaises(ValueError): await app.entity(tg,'@channel1')

    async def test_workspace_excludes_secrets(self):
        database=MagicMock(); database.execute.return_value.fetchall.return_value=[]
        with patch.object(app,'db') as db:
            db.return_value.__enter__.return_value=database
            self.assertEqual(await app.action('user-a',app.Command(action='workspace')),{'connections':[],'jobs':[],'logs':[]})
        self.assertNotIn('ciphertext',database.execute.call_args_list[0].args[0])

    def test_encryption(self):
        key=Fernet.generate_key()
        with patch.dict('os.environ',{'TELEGRAM_ENCRYPTION_KEY':key.decode()}):
            encrypted=app.cipher().encrypt(b'secret-session')
            self.assertNotIn(b'secret-session',encrypted)
            self.assertEqual(app.cipher().decrypt(encrypted),b'secret-session')
        from cryptography.fernet import InvalidToken
        with self.assertRaises(InvalidToken): Fernet(Fernet.generate_key()).decrypt(encrypted)
