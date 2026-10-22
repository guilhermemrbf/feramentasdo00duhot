"""Admin-only, in-place channel editing. Never downloads or republishes media."""
import asyncio
import base64
import copy
import json
import re
import threading
import time
from urllib.parse import urlsplit
from telethon import errors, types
from telethon.extensions import BinaryReader
from telethon.utils import get_peer_id
from .domain import UserError, channel_ref
from .store import now

DEFAULT_URL = 'https://t.me/vipacessoliberado_bot'


def encode_entities(entities):
    return [base64.b64encode(bytes(entity)).decode('ascii') for entity in entities or []]


def decode_entities(values):
    result = []
    for value in values:
        with BinaryReader(base64.b64decode(value, validate=True)) as reader:
            entity = reader.tgread_object()
        if not type(entity).__name__.startswith('MessageEntity'):
            raise UserError('Backup de formatação inválido.')
        result.append(entity)
    return result


def snapshot(message):
    media = getattr(message, 'media', None)
    media_object = getattr(media, 'photo', None) or getattr(media, 'document', None)
    buttons = getattr(message, 'reply_markup', None)
    return {
        'text': message.message or '',
        'entities': encode_entities(getattr(message, 'entities', None)),
        'media': [type(media).__name__, getattr(media_object, 'id', None)] if media and not isinstance(media, types.MessageMediaWebPage) else None,
        'preview': isinstance(media, types.MessageMediaWebPage),
        'buttons': base64.b64encode(bytes(buttons)).decode('ascii') if buttons else None,
    }


def same_content(a, b):
    # Web preview generation is asynchronous; it isn't an edit to the text/media.
    return all(a[key] == b[key] for key in ('text', 'entities', 'media', 'buttons'))


def destination_url(value):
    value = value.strip()
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in value) or len(value) > 2048:
        raise UserError('Informe um link HTTPS válido para o destino dos links.')
    return value


def rewrite(original, target, remove_ads=False, plain_urls=False):
    """Offsets are UTF-16 units, as required by Telegram (including emoji)."""
    target = destination_url(target)
    result = copy.deepcopy(original)
    removed, offset, kept = [], 0, []
    for line in original['text'].splitlines(keepends=True):
        size = len(line.encode('utf-16-le')) // 2
        normalized = ''.join(c for c in line.casefold() if c.isalpha())
        if remove_ads and normalized in ('outrosgrupos', 'hentai'):
            removed.append((offset, offset + size))
        else:
            kept.append(line)
        offset += size
    result['text'] = ''.join(kept)
    if not result['text'].strip():
        return None  # Never delete a whole publication or erase its caption.

    def adjusted(position):
        return position - sum(max(0, min(position, end) - start) for start, end in removed if position > start)

    entities, links = [], []
    for entity in decode_entities(original['entities']):
        start, end = adjusted(entity.offset), adjusted(entity.offset + entity.length)
        if end <= start:
            continue
        entity.offset, entity.length = start, end - start
        if isinstance(entity, types.MessageEntityTextUrl):
            if entity.url != target:
                links.append(entity.url)
                entity.url = target
        elif plain_urls and isinstance(entity, types.MessageEntityUrl):
            # Ctrl+K equivalent: retain the visible label, change its click target.
            raw = result['text'].encode('utf-16-le')[start*2:end*2].decode('utf-16-le')
            links.append(raw)
            entity = types.MessageEntityTextUrl(start, end-start, target)
        entities.append(entity)
    result['entities'] = encode_entities(entities)
    if same_content(original, result):
        return None
    return result, links


class EditStore:
    def __init__(self, store):
        self.store = store
        with store.lock, store.conn:
            store.conn.executescript('''
                create table if not exists edit_batches (
                    id integer primary key, channel text not null, title text not null,
                    owner integer not null, target text not null, status text not null,
                    scanned integer not null default 0, wait_until real not null default 0,
                    note text not null default '', created_at text not null);
                create table if not exists edit_items (
                    batch_id integer not null references edit_batches(id), message_id integer not null,
                    original text not null, desired text not null, links text not null,
                    status text not null default 'pending', note text not null default '',
                    primary key(batch_id,message_id));
            ''')
            store.conn.execute("update edit_batches set status='incomplete',note='Análise interrompida. Faça uma nova análise.' where status='scanning'")
            store.conn.execute("update edit_batches set status='paused',note='Operação interrompida. Confira a prévia e retome; cada post será verificado.' where status='applying'")

    def create(self, channel, title, owner, target):
        with self.store.lock, self.store.conn:
            return self.store.conn.execute("insert into edit_batches(channel,title,owner,target,status,created_at) values (?,?,?,?,'scanning',?)", (str(channel),title,owner,target,now())).lastrowid

    def add(self, batch, message_id, original, desired, links):
        with self.store.lock, self.store.conn:
            self.store.conn.execute('insert into edit_items(batch_id,message_id,original,desired,links) values (?,?,?,?,?)', (batch,message_id,json.dumps(original),json.dumps(desired),json.dumps(links)))

    def patch(self, batch, **fields):
        if set(fields) - {'status','scanned','note','wait_until'}:
            raise ValueError('Invalid editor batch update')
        with self.store.lock, self.store.conn:
            self.store.conn.execute('update edit_batches set '+','.join(k+'=?' for k in fields)+' where id=?', (*fields.values(),batch))

    def item_state(self, batch, message_id, status, note=''):
        with self.store.lock, self.store.conn:
            self.store.conn.execute('update edit_items set status=?,note=? where batch_id=? and message_id=?', (status,note,batch,message_id))

    def batches(self):
        with self.store.lock:
            return [dict(r) for r in self.store.conn.execute('select * from edit_batches order by id desc')]

    def batch(self, batch):
        with self.store.lock:
            row = self.store.conn.execute('select * from edit_batches where id=?',(batch,)).fetchone()
            if not row:
                raise UserError('Análise não encontrada.')
            return dict(row)

    def items(self, batch):
        with self.store.lock:
            return [dict(r) for r in self.store.conn.execute('select * from edit_items where batch_id=? order by message_id',(batch,))]


class ChannelEditor:
    def __init__(self, engine):
        self.engine = engine
        self.db = EditStore(engine.store)
        self.cancel = threading.Event()

    def idle_sync(self):
        if any(j['status'] == 'running' for j in self.engine.store.jobs()):
            raise UserError('Pause as sincronizações antes de analisar ou editar um canal.')

    async def channels(self):
        async with self.engine.lock:
            self.idle_sync()
            tg = await self.engine.connected()
            result = []
            async for dialog in tg.iter_dialogs():
                channel = dialog.entity
                if isinstance(channel, types.Channel) and channel.broadcast and (channel.creator or (channel.admin_rights and channel.admin_rights.edit_messages)):
                    result.append((str(get_peer_id(channel)), channel.title))
            return sorted(result, key=lambda item: item[1].casefold())

    async def channel(self, tg, reference):
        ref = channel_ref(reference)
        try:
            channel = await tg.get_entity(ref)
        except ValueError:
            await tg.get_dialogs(limit=None)
            channel = await tg.get_entity(ref)
        if not isinstance(channel, types.Channel) or not channel.broadcast:
            raise UserError('Selecione um canal de publicações que você administra.')
        permissions = await tg.get_permissions(channel, 'me')
        if not (permissions.is_creator or (permissions.is_admin and permissions.edit_messages)):
            raise UserError('A conta precisa ser dona do canal ou ter permissão para editar mensagens.')
        # noforwards prevents copying; it does not prevent an admin editing their own channel.
        return channel

    def progress(self, text):
        self.engine.emit('editor_progress', text)

    async def scan(self, reference, target, remove_ads=False, plain_urls=False):
        target = destination_url(target)
        self.cancel.clear()
        batch = None
        async with self.engine.lock:
            self.idle_sync()
            tg = await self.engine.connected()
            channel = await self.channel(tg, reference)
            owner = await tg.get_me()
            batch = self.db.create(get_peer_id(channel), channel.title, owner.id, target)
            scanned, candidates = 0, 0
            try:
                async for message in tg.iter_messages(channel, limit=None):
                    if self.cancel.is_set() or self.engine.stopping:
                        self.db.patch(batch, status='incomplete', scanned=scanned, note='Análise interrompida. Faça uma nova análise antes de aplicar.')
                        return batch
                    scanned += 1
                    if isinstance(message, types.Message) and message.message and not message.reply_markup:
                        original = snapshot(message)
                        proposal = rewrite(original, target, remove_ads, plain_urls)
                        if proposal:
                            desired, links = proposal
                            self.db.add(batch, message.id, original, desired, links)
                            candidates += 1
                    if scanned % 50 == 0:
                        self.db.patch(batch, scanned=scanned)
                        self.progress(f'Analisadas {scanned} publicações; {candidates} alterações propostas…')
                self.db.patch(batch, status='ready', scanned=scanned, note=f'{scanned} publicações analisadas; {candidates} alterações propostas. Posts com botões não são editados.')
            except BaseException:
                self.db.patch(batch, status='incomplete', scanned=scanned, note='Análise interrompida. Faça uma nova análise antes de aplicar.')
                raise
        return batch

    async def apply(self, batch_id, restore=False):
        from .engine import safe_error
        self.cancel.clear()
        async with self.engine.lock:
            self.idle_sync()
            batch = self.db.batch(batch_id)
            if batch['status'] in ('scanning','incomplete'):
                raise UserError('Esta análise está incompleta. Faça uma nova análise.')
            if time.time() < batch['wait_until']:
                raise UserError(f"Aguarde mais {int(batch['wait_until']-time.time())+1} segundos pelo limite do Telegram.")
            tg = await self.engine.connected()
            owner = await tg.get_me()
            if owner.id != batch['owner']:
                raise UserError('Conecte a mesma conta que criou esta análise.')
            channel = await self.channel(tg, batch['channel'])
            if str(get_peer_id(channel)) != batch['channel']:
                raise UserError('O canal não corresponde à prévia.')
            self.db.patch(batch_id, status='applying', note='Restaurando…' if restore else 'Aplicando…')
            try:
                for item in self.db.items(batch_id):
                    if self.cancel.is_set() or self.engine.stopping:
                        self.db.patch(batch_id, status='paused', note='Pausado pelo usuário. É possível retomar.')
                        return batch_id
                    if item['status'] != ('applied' if restore else 'pending'):
                        continue
                    expected = json.loads(item['desired' if restore else 'original'])
                    desired = json.loads(item['original' if restore else 'desired'])
                    message = await tg.get_messages(channel, ids=item['message_id'])
                    if not message:
                        self.db.item_state(batch_id,item['message_id'],'conflict','Publicação removida; ignorada.')
                        continue
                    current = snapshot(message)
                    final_state = 'restored' if restore else 'applied'
                    if same_content(current, desired):
                        self.db.item_state(batch_id,item['message_id'],final_state,'Conteúdo já confirmado no Telegram.')
                        continue
                    if not same_content(current, expected):
                        self.db.item_state(batch_id,item['message_id'],'conflict','Conteúdo mudou após a prévia; não foi sobrescrito.')
                        continue
                    await tg.edit_message(channel, item['message_id'], text=desired['text'],
                        formatting_entities=decode_entities(desired['entities']), parse_mode=None,
                        link_preview=desired['preview'])
                    # Re-read instead of trusting an update whose result could be missing.
                    confirmed = await tg.get_messages(channel, ids=item['message_id'])
                    if not confirmed or not same_content(snapshot(confirmed),desired):
                        raise UserError('Não foi possível confirmar a edição. Retome para verificar o estado no Telegram.')
                    self.db.item_state(batch_id,item['message_id'],final_state)
                    self.progress(f"Post {item['message_id']}: {'restaurado' if restore else 'editado'}.")
                    await asyncio.sleep(1.1)
                self.db.patch(batch_id, status='done', note='Restauração concluída.' if restore else 'Edição concluída. Confira os estados dos posts na lista.')
            except errors.FloodWaitError as reason:
                self.db.patch(batch_id,status='paused',wait_until=time.time()+reason.seconds+1,note=f'Limite Telegram: aguarde {reason.seconds} segundos e retome a operação.')
            except BaseException as reason:
                self.db.patch(batch_id,status='paused',note='Operação interrompida. '+(safe_error(reason) if isinstance(reason,Exception) else 'Retome para conferir o estado.'))
                raise
        return batch_id
