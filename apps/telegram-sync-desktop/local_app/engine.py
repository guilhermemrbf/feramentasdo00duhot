import asyncio
import json
import re
import contextlib
import time
from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from .domain import UserError
from .secrets import protect, unprotect


def safe_error(reason):
    if isinstance(reason, UserError):
        return str(reason)
    specific = {
        'ApiIdInvalidError': 'API ID ou API Hash inválidos. Copie os dois do mesmo aplicativo em my.telegram.org.',
        'ApiIdPublishedFloodError': 'O Telegram bloqueou este API ID por uso público excessivo. Confira o cadastro da aplicação.',
        'PhoneNumberInvalidError': 'Telefone inválido. Use +55, DDD e número; confira se essa conta existe no Telegram.',
        'PhoneNumberBannedError': 'O Telegram informou que este número está bloqueado. Confira a conta no aplicativo oficial.',
        'PhoneNumberFloodError': 'Foram solicitados códigos demais para este número. Aguarde antes de tentar novamente.',
        'PhonePasswordFloodError': 'O Telegram limitou as tentativas de login. Aguarde antes de tentar novamente.',
        'PhoneCodeInvalidError': 'Código Telegram incorreto. Tente novamente.',
        'PhoneCodeExpiredError': 'Código expirado. Cancele e solicite um novo código.',
        'PasswordHashInvalidError': 'Senha de verificação em duas etapas incorreta.',
        'AuthRestartError': 'O Telegram solicitou reiniciar o login. Cancele a janela e tente novamente após aguardar.',
        'PhoneMigrateError': 'O Telegram mudou o servidor desta conta. Cancele a janela e tente novamente.',
        'NetworkMigrateError': 'O Telegram mudou o servidor de conexão. Cancele a janela e tente novamente.',
        'UserMigrateError': 'O Telegram mudou o servidor desta conta. Reconecte e tente novamente.',
        'AuthKeyDuplicatedError': 'O Telegram invalidou esta sessão. Desconecte a conta local e faça login novamente.',
        'SessionRevokedError': 'Esta sessão foi revogada no Telegram. Desconecte a conta local e conecte novamente.',
    }
    for name, message in specific.items():
        error_type = getattr(errors,name,None)
        if error_type is not None and isinstance(reason,error_type):
            return message + ' [' + name + ']'
    if isinstance(reason, errors.FloodWaitError):
        return f'O Telegram pediu uma espera de {reason.seconds} segundos. Aguarde esse prazo antes de tentar novamente. [FloodWaitError]'
    if isinstance(reason, TimeoutError):
        return 'Tempo limite ao falar com o Telegram. Confira se o código chegou e verifique sua conexão antes de tentar de novo. [TimeoutError]'
    if isinstance(reason, ConnectionError):
        return 'Não foi possível conectar ao Telegram. Confira a internet e se sua rede permite o acesso ao Telegram. [ConnectionError]'
    if isinstance(reason, OSError):
        return 'Falha de rede ou do Windows. Confira sua conexão e tente novamente. [OSError]'
    identifier = re.sub(r'[^A-Za-z0-9_]', '', type(reason).__name__)[:60]
    if isinstance(reason, errors.RPCError):
        return f'O Telegram recusou a operação. Informe o identificador para diagnóstico: [{identifier}]'
    return f'Falha técnica ao concluir a operação. Informe este identificador para diagnóstico: [{identifier}]'


def telegram_client(session, api_id, api_hash, *, login=False):
    # Login must be able to repeat after PHONE_MIGRATE/NETWORK_MIGRATE.
    # Publishing retains zero automatic retries so unknown sends stay reviewable.
    return TelegramClient(StringSession(session),api_id,api_hash,
        flood_sleep_threshold=0, request_retries=3 if login else 0,
        raise_last_call_error=True, connection_retries=2, timeout=20,
        device_model='Telegram Sync Desktop', app_version='0.7.1')


class Engine:
    def __init__(self, store, emit=lambda *_: None):
        self.store, self.emit = store, emit
        self.client = None
        self.pending_login = None
        self.lock = asyncio.Lock()
        self.stopping = False
        from .editor import ChannelEditor
        self.editor = ChannelEditor(self)
        self.store.retire_publication_features()

    async def begin_login(self, api_id, api_hash, phone):
        async with self.lock:
            if self.store.setting('account'):
                raise UserError('Desconecte a conta atual antes de conectar outra.')
            try:
                api_id = int(api_id)
                if api_id <= 0 or len(api_hash.strip()) != 32 or any(c not in '0123456789abcdefABCDEF' for c in api_hash.strip()):
                    raise ValueError()
            except ValueError:
                raise UserError('Preencha o API ID numérico e o API Hash de 32 caracteres obtidos em my.telegram.org.') from None
            phone = re.sub(r'[\s().-]', '', phone.strip())
            if not re.fullmatch(r'\+[1-9][0-9]{7,14}', phone):
                raise UserError('Informe o telefone com código do país, DDD e número, por exemplo +55…')
            await self._abort_login()
            tg = telegram_client('',api_id,api_hash.strip(),login=True)
            try:
                await asyncio.wait_for(tg.connect(),timeout=30)
                try:
                    result = await asyncio.wait_for(tg.send_code_request(phone),timeout=45)
                    phone_hash, needs_password = result.phone_code_hash, False
                except errors.SessionPasswordNeededError:
                    phone_hash, needs_password = None, True
                self.pending_login = {'tg':tg,'api_id':api_id,'api_hash':api_hash.strip(),'phone':phone,'hash':phone_hash,'expires':time.monotonic()+600,'needs_password':needs_password}
            except BaseException:
                with contextlib.suppress(Exception):
                    await tg.disconnect()
                raise
            return 'password' if needs_password else 'code'

    async def finish_login(self, code='', password=''):
        async with self.lock:
            pending = self.pending_login
            if not pending or pending['expires'] < time.monotonic():
                await self._abort_login()
                raise UserError('Login expirado. Solicite um novo código.')
            tg = pending['tg']
            try:
                if pending['needs_password']:
                    if not password:
                        raise UserError('Informe a senha de verificação em duas etapas.')
                    await tg.sign_in(password=password)
                else:
                    await tg.sign_in(phone=pending['phone'],code=code.strip(),phone_code_hash=pending['hash'])
            except errors.SessionPasswordNeededError:
                pending['needs_password'] = True
                return 'password'
            if not await tg.is_user_authorized():
                raise UserError('O Telegram ainda não confirmou o acesso.')
            me = await tg.get_me()
            if getattr(me,'bot',False):
                raise UserError('Conecte uma conta de usuário Telegram para importar históricos.')
            account = {'api_id':pending['api_id'],'api_hash':pending['api_hash'],'session':tg.session.save(),'label':me.first_name or 'Conta Telegram'}
            try:
                self.store.save_account(protect(json.dumps(account)))
            except BaseException:
                # Do not leave an in-memory authorized account running after persistence fails.
                await self._abort_login()
                raise
            self.client = None
            self.pending_login = None
            # Restore with the publishing policy on the next operation.
            with contextlib.suppress(Exception):
                await tg.disconnect()
            self.emit('account',account['label'])
            return 'connected'

    async def _abort_login(self):
        if self.pending_login:
            await self.pending_login['tg'].disconnect()
            self.pending_login = None

    async def abort_login(self):
        async with self.lock:
            await self._abort_login()

    async def connected(self):
        if self.client is None:
            sealed = self.store.setting('account')
            if not sealed:
                raise UserError('Conecte sua conta Telegram primeiro.')
            try:
                account = json.loads(unprotect(sealed))
            except UserError:
                raise
            except Exception:
                raise UserError('Não foi possível abrir a conta salva. Desconecte e conecte novamente.') from None
            self.client = telegram_client(account['session'],account['api_id'],account['api_hash'])
        await self.client.connect()
        if not await self.client.is_user_authorized():
            raise UserError('A sessão Telegram foi revogada. Cancele as tarefas e conecte novamente.')
        return self.client

    async def disconnect(self, revoke=False):
        async with self.lock:
            if revoke:
                tg = await self.connected()
                await tg.log_out()
            elif self.client:
                await self.client.disconnect()
            self.client = None
            self.store.clear_account()
            self.emit('account','Desconectado')

    async def shutdown(self):
        self.stopping = True
        self.editor.cancel.set()
        await self._abort_login()
        if self.client:
            await self.client.disconnect()
