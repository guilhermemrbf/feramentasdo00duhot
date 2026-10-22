import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Literal

import httpx
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from cryptography.fernet import Fernet
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from telethon import TelegramClient, errors, types
from telethon.sessions import StringSession
from core import channel_ref, replace


def db():
    return psycopg.connect(os.environ['TELEGRAM_DATABASE_URL'], row_factory=dict_row)


def cipher():
    return Fernet(os.environ['TELEGRAM_ENCRYPTION_KEY'].encode())


def client(session=''):
    return TelegramClient(StringSession(session), int(os.environ['TELEGRAM_API_ID']), os.environ['TELEGRAM_API_HASH'])


async def owner(authorization):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Entre na sua conta.')
    async with httpx.AsyncClient(timeout=10) as http:
        result = await http.get(os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/user', headers={
            'Authorization': authorization, 'apikey': os.environ['SUPABASE_PUBLISHABLE_KEY']})
    if result.status_code != 200:
        raise HTTPException(401, 'Sessão expirada.')
    return result.json()['id']


class Rule(BaseModel):
    find: str = Field(min_length=1, max_length=2048)
    replacement: str = Field(max_length=2048)


class Command(BaseModel):
    action: Literal['workspace', 'connect', 'resolve', 'create', 'pause', 'resume', 'cancel', 'disconnect', 'preview']
    id: uuid.UUID | None = None
    name: str = Field(default='Minha conta', min_length=1, max_length=100)
    session: str = Field(default='', max_length=10000)
    source: str = Field(default='', max_length=200)
    destination: str = Field(default='', max_length=200)
    mode: Literal['history', 'continuous'] = 'history'
    rules: list[Rule] = Field(default_factory=list, max_length=50)
    authorized: bool = False
    text: str = Field(default='', max_length=4096)


async def entity(tg, value):
    ref = channel_ref(value)
    try:
        result = await tg.get_entity(ref)
    except ValueError:
        # Numeric private IDs need the session's access_hash from its dialogs.
        await tg.get_dialogs(limit=None)
        result = await tg.get_entity(ref)
    if not isinstance(result, (types.Channel, types.Chat)):
        raise ValueError('Selecione um canal ou grupo, não uma pessoa.')
    if getattr(result, 'noforwards', False):
        raise ValueError('Este canal tem proteção de conteúdo.')
    return result


async def pair(tg, source, destination):
    src, dst = await entity(tg, source), await entity(tg, destination)
    if src.id == dst.id:
        raise ValueError('Origem e destino devem ser diferentes.')
    permissions = await tg.get_permissions(dst, 'me')
    if not (permissions.is_creator or permissions.is_admin):
        raise ValueError('A conta precisa administrar o destino.')
    if isinstance(dst, types.Channel) and dst.broadcast and not (permissions.is_creator or getattr(permissions, 'post_messages', False)):
        raise ValueError('Sem permissão para publicar no destino.')
    return src, dst


async def action(user, cmd):
    rules = [r.model_dump() for r in cmd.rules]
    if cmd.action == 'preview':
        return {'text': replace(cmd.text, rules)}
    with db() as conn:
        if cmd.action == 'workspace':
            return {
                'connections': conn.execute('select id,name,created_at from tg_connections where user_id=%s', (user,)).fetchall(),
                'jobs': conn.execute('select * from tg_sync_jobs where user_id=%s order by created_at desc limit 200', (user,)).fetchall(),
                'logs': conn.execute('select l.* from tg_audit_logs l join tg_sync_jobs j on j.id=l.job_id where j.user_id=%s order by l.id desc limit 100', (user,)).fetchall()}
        if cmd.action == 'connect':
            tg = client(cmd.session)
            try:
                await tg.connect()
                if not await tg.is_user_authorized():
                    raise ValueError('Sessão Telegram inválida ou revogada.')
                encrypted = cipher().encrypt(tg.session.save().encode()).decode()
                return conn.execute('insert into tg_connections(user_id,name,session_ciphertext) values (%s,%s,%s) returning id,name', (user, cmd.name, encrypted)).fetchone()
            finally:
                await tg.disconnect()
        if cmd.action in ('pause','resume','cancel'):
            # Worker holds this row lock through publication; controls take effect between batches.
            row = conn.execute('select * from tg_sync_jobs where id=%s and user_id=%s for update', (cmd.id,user)).fetchone()
            if not row:
                raise HTTPException(404, 'Tarefa não encontrada.')
            if row['status'] in ('cancelled','completed') or (row['status']=='attention' and cmd.action!='cancel'):
                raise ValueError('Tarefa encerrada ou requer conferência manual. Crie outra após revisar o histórico.')
            status = {'pause':'paused','resume':'running','cancel':'cancelled'}[cmd.action]
            conn.execute('update tg_sync_jobs set status=%s where id=%s', (status,cmd.id))
            conn.execute('insert into tg_audit_logs(job_id,event) values (%s,%s)',(cmd.id,status))
            return {'status':status}
        row = conn.execute('select * from tg_connections where id=%s and user_id=%s', (cmd.id,user)).fetchone()
        if not row:
            raise HTTPException(404, 'Conexão não encontrada.')
        if cmd.action == 'disconnect':
            active = conn.execute("select id from tg_sync_jobs where connection_id=%s and status in ('running','paused','attention')", (cmd.id,)).fetchone()
            if active:
                raise ValueError('Encerre as tarefas antes de remover a conexão.')
            conn.execute('delete from tg_connections where id=%s',(cmd.id,))
            return {'removed':True}
        tg = client(cipher().decrypt(row['session_ciphertext'].encode()).decode())
        try:
            await tg.connect()
            src,dst = await pair(tg,cmd.source,cmd.destination)
            from telethon.utils import get_peer_id
            data = {'source':str(get_peer_id(src)), 'destination':str(get_peer_id(dst)), 'source_title':src.title,'destination_title':dst.title}
            if cmd.action == 'resolve':
                return data
            if not cmd.authorized:
                raise ValueError('Confirme a autorização para republicação.')
            # Serialize graph validation across owners without exposing other accounts.
            conn.execute('select pg_advisory_xact_lock(hashtextextended(%s,1))',(user,))
            edges=conn.execute("select source,destination from tg_sync_jobs where user_id=%s and status in ('running','paused','attention')",(user,)).fetchall()
            frontier=[data['destination']]; visited=set()
            while frontier:
                node=frontier.pop()
                if node==data['source']:
                    raise ValueError('Esta tarefa criaria um ciclo entre canais.')
                if node in visited:
                    continue
                visited.add(node)
                frontier.extend(e['destination'] for e in edges if e['source']==node)
            if any(e['source']==data['source'] and e['destination']==data['destination'] for e in edges):
                raise ValueError('Já existe uma tarefa ativa para estes canais.')
            latest = await tg.get_messages(src,limit=1)
            upper = latest[0].id if latest else 0
            return conn.execute('''insert into tg_sync_jobs(user_id,connection_id,source,destination,source_title,destination_title,mode,rules,until_id)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s) returning *''', (user,cmd.id,data['source'],data['destination'],src.title,dst.title,cmd.mode,Jsonb(rules),upper)).fetchone()
        finally:
            await tg.disconnect()


async def tick():
    # SKIP LOCKED allows multiple workers; a session advisory lock prevents concurrent account use.
    with db() as conn:
        job = conn.execute("select * from tg_sync_jobs where status='running' and next_run<=now() order by next_run for no key update skip locked limit 1").fetchone()
        if not job:
            return
        lock = conn.execute('select pg_try_advisory_xact_lock(hashtextextended(%s,0)) as ok',(str(job['connection_id']),)).fetchone()
        if not lock['ok']:
            return
        connection = conn.execute('select * from tg_connections where id=%s and user_id=%s',(job['connection_id'],job['user_id'])).fetchone()
        tg = client(cipher().decrypt(connection['session_ciphertext'].encode()).decode())
        try:
            await tg.connect()
            src,dst = await pair(tg,job['source'],job['destination'])
            if job['mode']=='continuous':
                latest = await tg.get_messages(src,limit=1)
                upper = latest[0].id if latest else job['checkpoint']
            else:
                upper = job['until_id']
            messages = [m async for m in tg.iter_messages(src,min_id=job['checkpoint'],max_id=upper+1,reverse=True,limit=100)]
            # Complete the last album before advancing the cursor.
            if messages and messages[-1].grouped_id:
                tail = messages[-1]
                for m in [m async for m in tg.iter_messages(src,min_id=tail.id,max_id=upper+1,reverse=True,limit=10)]:
                    if m.grouped_id != tail.grouped_id:
                        break
                    messages.append(m)
            groups=[]
            for m in messages:
                if groups and m.grouped_id and groups[-1][0].grouped_id==m.grouped_id:
                    groups[-1].append(m)
                else:
                    groups.append([m])
            for batch in groups:
                if job['mode']=='continuous' and batch[0].grouped_id and (datetime.now(timezone.utc)-batch[-1].date).total_seconds()<5:
                    break  # Allow Telegram's new album to finish arriving.
                if any(getattr(m,'noforwards',False) for m in batch):
                    raise ValueError('Publicação protegida: tarefa interrompida.')
                # Durable reservation BEFORE Telegram side effects. Unknown outcomes require review,
                # never an automatic resend that could duplicate a post.
                with db() as ledger:
                    prior = ledger.execute('select state from tg_message_map where job_id=%s and source_id=%s',(job['id'],batch[0].id)).fetchone()
                    if prior and prior['state']=='sending':
                        raise ValueError('Envio anterior sem confirmação. Confira o destino antes de criar uma nova tarefa.')
                    if not prior:
                        for item in batch:
                            ledger.execute("insert into tg_message_map(job_id,source_id,state) values (%s,%s,'sending')",(job['id'],item.id))
                if not prior:
                    if all(isinstance(m, types.MessageService) for m in batch):
                        sent=[]
                    else:
                        # Flatten existing entities to explicit text URLs, preserving hidden links.
                        captions=[]
                        for m in batch:
                            text=m.message or ''
                            for ent, label in reversed(m.get_entities_text()):
                                if isinstance(ent,types.MessageEntityTextUrl):
                                    # UTF-16 offsets, including emoji before links.
                                    raw=text.encode('utf-16-le'); start=ent.offset*2; end=start+ent.length*2
                                    text=(raw[:start]+f'{label} ({ent.url})'.encode('utf-16-le')+raw[end:]).decode('utf-16-le')
                            captions.append(replace(text,job['rules']))
                        if any(len(t.encode('utf-16-le'))//2 > (1024 if m.media else 4096) for t,m in zip(captions,batch)):
                            raise ValueError('Legenda excede o limite após substituições.')
                        if len(batch)>1:
                            sent=await tg.send_file(dst,[m.media for m in batch],caption=captions,parse_mode=None)
                        elif batch[0].media and not isinstance(batch[0].media,types.MessageMediaWebPage):
                            if not isinstance(batch[0].media,(types.MessageMediaPhoto,types.MessageMediaDocument)):
                                raise ValueError('Tipo de mídia não suportado. Revise a publicação.')
                            sent=[await tg.send_file(dst,batch[0].media,caption=captions[0],parse_mode=None)]
                        elif captions[0]:
                            sent=[await tg.send_message(dst,captions[0],parse_mode=None,link_preview=False)]
                        else:
                            sent=[]
                    with db() as ledger:
                        for index,item in enumerate(batch):
                            ids=[sent[index].id] if index<len(sent) else []
                            ledger.execute('update tg_message_map set state=%s,destination_ids=%s where job_id=%s and source_id=%s',('sent' if ids else 'skipped',Jsonb(ids),job['id'],item.id))
                conn.execute('update tg_sync_jobs set checkpoint=%s,processed=processed+%s where id=%s',(batch[-1].id,len(batch),job['id']))
            done=job['mode']=='history' and len(messages)<100
            conn.execute("update tg_sync_jobs set status=%s,next_run=now()+interval '15 seconds',error=null where id=%s",('completed' if done else 'running',job['id']))
            if messages or done:
                conn.execute('insert into tg_audit_logs(job_id,event) values (%s,%s)',(job['id'],f'{len(messages)} mensagens processadas; '+('concluído' if done else 'aguardando próximo lote')))
        except errors.FloodWaitError as exc:
            # No blind retry: reservations may already exist if Telegram rejected a send.
            conn.execute("update tg_sync_jobs set next_run=now()+(%s * interval '1 second'),error='Aguardando limite do Telegram' where id=%s",(exc.seconds+1,job['id']))
        except Exception as exc:
            message=str(exc) if isinstance(exc,ValueError) else 'Falha na integração. Confira permissões, sessão e o destino antes de retomar.'
            conn.execute("update tg_sync_jobs set status='attention',error=%s where id=%s",(message,job['id']))
            conn.execute('insert into tg_audit_logs(job_id,event) values (%s,%s)',(job['id'],message))
        finally:
            await tg.disconnect()


async def worker():
    while True:
        try:
            await tick()
        except Exception:
            # Do not log exceptions containing secrets or raw Telegram messages.
            print('Telegram Sync: worker indisponível; nova tentativa em 5s',flush=True)
        await asyncio.sleep(5)


app=FastAPI(docs_url=None,redoc_url=None)


@app.post('/command')
async def command(cmd:Command, authorization:str|None=Header(default=None)):
    user=await owner(authorization)
    try:
        # Serialize account API access across workers, with a separate advisory lock namespace.
        with db() as guard:
            locked=guard.execute('select pg_try_advisory_xact_lock(hashtextextended(%s,0)) as ok',(str(cmd.id) if cmd.id else user,)).fetchone()
            if not locked['ok']:
                raise HTTPException(409,'Conta ocupada. Aguarde o lote atual e tente novamente.')
            return await action(user,cmd)
    except ValueError as exc:
        raise HTTPException(400,str(exc)) from None
    except errors.RPCError:
        raise HTTPException(400,'Telegram recusou a operação. Confira sessão, acesso e permissões.') from None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503,'Serviço indisponível. Confira a configuração do Telegram Sync.') from None


@app.get("/healthz")
def healthz():
    # Liveness only; startup checks credentials and the database schema separately.
    return {"status": "ok"}
