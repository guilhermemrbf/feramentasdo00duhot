import asyncio
import json
import time
from datetime import datetime, timezone
from telethon import TelegramClient, errors, types
from telethon.sessions import StringSession
from telethon.utils import get_peer_id
from .domain import UserError, channel_ref, caption, media_batches, validate_rules
from .secrets import protect, unprotect


def safe_error(reason):
    if isinstance(reason, UserError):
        return str(reason)
    if isinstance(reason, errors.PhoneCodeInvalidError):
        return 'Código Telegram incorreto. Tente novamente.'
    if isinstance(reason, errors.PhoneCodeExpiredError):
        return 'Código expirado. Cancele e solicite um novo código.'
    if isinstance(reason, errors.PasswordHashInvalidError):
        return 'Senha de verificação em duas etapas incorreta.'
    if isinstance(reason, errors.FloodWaitError):
        return f'O Telegram pediu uma espera de {reason.seconds} segundos.'
    if isinstance(reason, errors.RPCError):
        return 'O Telegram recusou a operação. Confira conta, acesso e permissões.'
    return 'Não foi possível concluir. Confira sua conexão e as permissões; tente novamente.'


class Engine:
    def __init__(self, store, emit=lambda *_: None):
        self.store, self.emit = store, emit
        self.client = None
        self.pending_login = None
        self.lock = asyncio.Lock()
        self.stopping = False

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
            if not phone.strip().startswith('+'):
                raise UserError('Informe o telefone com código do país, por exemplo +55…')
            await self._abort_login()
            tg = TelegramClient(StringSession(),api_id,api_hash.strip(),flood_sleep_threshold=0,request_retries=0,timeout=20)
            try:
                await tg.connect()
                result = await tg.send_code_request(phone.strip())
                self.pending_login = {'tg':tg,'api_id':api_id,'api_hash':api_hash.strip(),'phone':phone.strip(),'hash':result.phone_code_hash,'expires':time.monotonic()+600,'needs_password':False}
            except BaseException:
                await tg.disconnect()
                raise
            return 'code'

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
            self.client = tg
            self.pending_login = None
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
            self.client = TelegramClient(StringSession(account['session']),account['api_id'],account['api_hash'],flood_sleep_threshold=0,request_retries=0,timeout=20)
        await self.client.connect()
        if not await self.client.is_user_authorized():
            raise UserError('A sessão Telegram foi revogada. Cancele as tarefas e conecte novamente.')
        return self.client

    async def disconnect(self, revoke=False):
        async with self.lock:
            if any(j['status'] in ('running','paused','attention') for j in self.store.jobs()):
                raise UserError('Cancele as tarefas pendentes antes de desconectar a conta.')
            if revoke:
                tg = await self.connected()
                await tg.log_out()
            elif self.client:
                await self.client.disconnect()
            self.client = None
            self.store.clear_account()
            self.emit('account','Desconectado')

    async def entity(self, tg, reference):
        ref = channel_ref(reference)
        try:
            entity = await tg.get_entity(ref)
        except ValueError:
            await tg.get_dialogs(limit=None)
            entity = await tg.get_entity(ref)
        if not isinstance(entity,(types.Channel,types.Chat)):
            raise UserError('Selecione um canal ou grupo, não uma pessoa.')
        if getattr(entity,'noforwards',False):
            raise UserError('O canal tem proteção de conteúdo. A cópia foi bloqueada.')
        return entity

    async def pair(self, tg, source, destination):
        src, dst = await self.entity(tg,source), await self.entity(tg,destination)
        if get_peer_id(src) == get_peer_id(dst):
            raise UserError('Origem e destino precisam ser diferentes.')
        permissions = await tg.get_permissions(dst,'me')
        if not (permissions.is_creator or permissions.is_admin):
            raise UserError('A conta conectada precisa administrar o destino.')
        if isinstance(dst,types.Channel) and dst.broadcast and not (permissions.is_creator or permissions.post_messages):
            raise UserError('Falta permissão para publicar no canal de destino.')
        return src,dst

    async def resolve(self, source, destination):
        async with self.lock:
            tg = await self.connected()
            src,dst = await self.pair(tg,source,destination)
            return f'{src.title} ({get_peer_id(src)}) → {dst.title} ({get_peer_id(dst)})'

    async def create(self, source, destination, mode, rules, authorized):
        if not authorized:
            raise UserError('Confirme que tem autorização para republicar o conteúdo.')
        rules = validate_rules(rules)
        async with self.lock:
            tg = await self.connected()
            src,dst = await self.pair(tg,source,destination)
            latest = await tg.get_messages(src,limit=1)
            if latest and latest[0].grouped_id and (datetime.now(timezone.utc)-latest[0].date).total_seconds()<5:
                raise UserError('Um álbum acabou de chegar à origem. Aguarde alguns segundos e crie novamente.')
            job_id = self.store.create(str(get_peer_id(src)),str(get_peer_id(dst)),src.title,dst.title,mode,rules,latest[0].id if latest else 0)
            self.emit('refresh',None)
            return job_id

    async def process(self, job):
        tg = await self.connected()
        src,dst = await self.pair(tg,job['source'],job['destination'])
        upper = job['until_id']
        if job['mode'] == 'continuous':
            latest = await tg.get_messages(src,limit=1)
            upper = latest[0].id if latest else job['checkpoint']
        messages = [m async for m in tg.iter_messages(src,min_id=job['checkpoint'],max_id=upper+1,reverse=True,limit=25)]
        if messages and messages[-1].grouped_id:
            tail = messages[-1]
            async for message in tg.iter_messages(src,min_id=tail.id,max_id=upper+1,reverse=True,limit=10):
                if message.grouped_id != tail.grouped_id:
                    break
                messages.append(message)
        for batch in media_batches(messages):
            if self.stopping or self.store.job(job['id'])['status'] != 'running':
                return
            if job['mode']=='continuous' and batch[0].grouped_id and (datetime.now(timezone.utc)-batch[-1].date).total_seconds()<5:
                return
            if any(getattr(m,'noforwards',False) for m in batch):
                raise UserError('Publicação protegida. A tarefa foi interrompida.')
            ids = [m.id for m in batch]
            # Validate everything before the durable reservation (no side effects yet).
            service = all(isinstance(m,types.MessageService) for m in batch)
            texts = [] if service else [caption(m,json.loads(job['rules'])) for m in batch]
            if not service:
                for text,message in zip(texts,batch):
                    media = message.media and not isinstance(message.media,types.MessageMediaWebPage)
                    if media and not isinstance(message.media,(types.MessageMediaPhoto,types.MessageMediaDocument)):
                        raise UserError('Esta publicação contém um tipo de mídia ainda não suportado.')
                    if len(text.encode('utf-16-le'))//2 > (1024 if media else 4096):
                        raise UserError('O texto após as substituições ultrapassou o limite do Telegram.')
                if len(batch)>1 and not all(isinstance(m.media,(types.MessageMediaPhoto,types.MessageMediaDocument)) for m in batch):
                    raise UserError('Álbum com mídia incompatível. Confira a origem.')
            if not self.store.reserve(job['id'],ids):
                self.store.advance_confirmed(job['id'],ids)
                continue
            try:
                if service:
                    sent = []
                elif len(batch)>1:
                    sent = await tg.send_file(dst,[m.media for m in batch],caption=texts,parse_mode=None)
                elif batch[0].media and not isinstance(batch[0].media,types.MessageMediaWebPage):
                    sent = [await tg.send_file(dst,batch[0].media,caption=texts[0],parse_mode=None)]
                elif texts[0]:
                    sent = [await tg.send_message(dst,texts[0],parse_mode=None,link_preview=False)]
                else:
                    sent = []
            except errors.FloodWaitError as reason:
                # Telegram definitively rejected this operation; safely release its reservation.
                self.store.defer(job['id'],ids,reason.seconds)
                self.store.log(job['id'],f'Limite Telegram: aguardando {reason.seconds} segundos.')
                return
            self.store.confirm(job['id'],ids,[m.id for m in sent])
            self.store.log(job['id'],f'Origem {ids[0]}–{ids[-1]}: '+('publicado.' if sent else 'mensagem de serviço/vazia ignorada.'))
            self.emit('refresh',None)
            await asyncio.sleep(1)
        current = self.store.job(job['id'])
        if current['status'] == 'running':
            if job['mode']=='history' and len(messages)<25:
                self.store.patch(job['id'],status='completed',error=None)
                self.store.log(job['id'],'Importação concluída.')
            else:
                self.store.patch(job['id'],next_run=time.time()+10,error=None)

    async def run(self):
        while not self.stopping:
            due = [j for j in self.store.jobs() if j['status']=='running' and j['next_run']<=time.time()]
            # Oldest first; use a short batch to allow other jobs and controls to progress.
            for job in reversed(due):
                if self.stopping:
                    break
                async with self.lock:
                    if self.store.job(job['id'])['status'] != 'running':
                        continue
                    try:
                        await self.process(job)
                    except asyncio.CancelledError:
                        raise
                    except errors.FloodWaitError as reason:
                        self.store.patch(job['id'],next_run=time.time()+reason.seconds+1,error='Aguardando limite do Telegram.')
                    except Exception as reason:
                        message = ('Envio sem confirmação. Confira o destino antes de decidir a recuperação.' if self.store.pending(job['id']) else safe_error(reason))
                        self.store.patch(job['id'],status='attention',error=message)
                        self.store.log(job['id'],message)
                    self.emit('refresh',None)
                await asyncio.sleep(0)
            await asyncio.sleep(0.5)

    async def shutdown(self):
        self.stopping = True
        await self._abort_login()
        if self.client:
            await self.client.disconnect()
