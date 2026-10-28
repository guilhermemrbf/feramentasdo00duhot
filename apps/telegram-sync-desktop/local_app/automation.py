"""Local daily schedules. Nothing runs until the operator activates an agenda."""
import asyncio
import json
import re
import time
from datetime import datetime, timedelta
from telethon import errors, types
from telethon.utils import get_peer_id
from .domain import UserError, media_batches
from .editor import destination_url, snapshot, rewrite, decode_entities
from .forwarding import latest_selection


def schedule_times(values):
    if not isinstance(values,list) or not 1 <= len(values) <= 5:
        raise UserError('Escolha de um a cinco horários por dia.')
    if any(not isinstance(value,str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',value) for value in values) or len(set(values))!=len(values):
        raise UserError('Use horários diferentes no formato HH:MM, de 00:00 a 23:59.')
    return sorted(values)


def next_slot(values, after):
    """Use Windows local wall time, including its timezone conversion per date."""
    values=schedule_times(values)
    day=datetime.fromtimestamp(after).date()
    for offset in (0,1,2):
        for value in values:
            candidate=datetime.combine(day+timedelta(days=offset),datetime.strptime(value,'%H:%M').time()).timestamp()
            if candidate>after:return candidate
    raise UserError('Não foi possível calcular o próximo horário local.')


def prepared(message,target):
    if getattr(message,'noforwards',False):
        raise UserError('A seleção contém conteúdo protegido. Nenhuma proteção será removida.')
    if getattr(message,'reply_markup',None):
        raise UserError('A seleção contém botões. A automação não altera links de botões; confira a origem.')
    media=message.media and not isinstance(message.media,types.MessageMediaWebPage)
    if media and not isinstance(message.media,(types.MessageMediaPhoto,types.MessageMediaDocument)):
        raise UserError('A seleção contém mídia ainda não suportada pela automação.')
    original=snapshot(message)
    changed=rewrite(original,target,plain_urls=True)
    desired=changed[0] if changed else original
    if len(desired['text'].encode('utf-16-le'))//2 > (1024 if media else 4096):
        raise UserError('O texto da publicação ultrapassa o limite do Telegram.')
    if not media and not desired['text']:
        raise UserError('Publicação vazia ou não suportada pela automação.')
    return desired


class AutomationStore:
    def __init__(self,store):
        self.store=store
        with store.lock,store.conn:
            store.conn.executescript('''
                create table if not exists automations (
                    id integer primary key, source text not null, destination text not null,
                    source_title text not null, destination_title text not null, owner integer not null,
                    target text not null, times text not null, state text not null default 'paused',
                    next_run real not null default 0, note text not null default '', check(source<>destination));
                create table if not exists automation_runs (
                    id integer primary key, automation_id integer not null references automations(id),
                    groups_json text not null, target text not null, cursor integer not null default 0,
                    state text not null default 'ready', retry_at real not null default 0,
                    created_at real not null);
                create unique index if not exists automation_one_pending_run on automation_runs(automation_id) where state='ready';
                create table if not exists automation_messages (
                    automation_id integer not null references automations(id), source_id integer not null,
                    run_id integer not null references automation_runs(id), state text not null,
                    destination_id integer, primary key(automation_id,source_id));
            ''')
            store.conn.execute("update automations set state='paused',note='Execução interrompida. Ative para retomar a seleção no próximo horário.' where state='active' and id in (select automation_id from automation_runs where state='ready')")
            store.conn.execute("update automations set state='attention',note='Envio sem confirmação. Confira o destino antes de retomar.' where id in (select automation_id from automation_messages where state='sending')")

    def rows(self):
        with self.store.lock:
            return [dict(row) for row in self.store.conn.execute('''select a.*,
                (select count(*) from automation_messages m where m.automation_id=a.id and m.state='sent') as sent,
                (select count(*) from automation_messages m where m.automation_id=a.id and m.state='sending') as pending
                from automations a order by a.id desc''')]

    def row(self,identifier):
        return next((row for row in self.rows() if row['id']==identifier),None) or self.missing()

    @staticmethod
    def missing():raise UserError('Automação não encontrada.')

    def run(self,identifier):
        with self.store.lock:
            row=self.store.conn.execute("select * from automation_runs where automation_id=? and state='ready'",(identifier,)).fetchone()
            return dict(row) if row else None

    def patch(self,identifier,**values):
        if not values or set(values)-{'state','next_run','note'}:raise ValueError('Invalid automation update')
        with self.store.lock,self.store.conn:
            self.store.conn.execute('update automations set '+','.join(key+'=?' for key in values)+' where id=?',(*values.values(),identifier))

    def save(self,source,destination,source_title,destination_title,owner,target,times,identifier=None):
        times=schedule_times(times);target=destination_url(target)
        with self.store.lock,self.store.conn:
            if identifier is not None:
                previous=self.row(identifier)
                if previous['state']!='paused' or self.run(identifier):
                    raise UserError('Pause e conclua a execução pendente antes de alterar a automação.')
                if previous['owner']!=owner:raise UserError('Esta automação pertence a outra conta Telegram.')
                if (previous['source'],previous['destination'])!=(source,destination):
                    raise UserError('Para mudar os canais, crie outra automação. O histórico de envios será separado.')
            edges=self.store.publication_edges(exclude_automation=identifier)
            if source==destination or any(a==source and b==destination for a,b in edges):
                raise UserError('Origem e destino precisam ser diferentes e não podem ter outra cópia pendente.')
            nodes,visited=[destination],set()
            while nodes:
                node=nodes.pop()
                if node==source:raise UserError('Esta automação criaria um ciclo de publicações.')
                if node not in visited:
                    visited.add(node);nodes.extend(b for a,b in edges if a==node)
            if identifier is None:
                identifier=self.store.conn.execute('insert into automations(source,destination,source_title,destination_title,owner,target,times) values (?,?,?,?,?,?,?)',
                    (source,destination,source_title,destination_title,owner,target,json.dumps(times))).lastrowid
            else:
                self.store.conn.execute("update automations set target=?,times=?,note='Agenda atualizada e pausada.' where id=?",(target,json.dumps(times),identifier))
            return identifier

    def control(self,identifier,action,now=None):
        now=time.time() if now is None else now
        with self.store.lock,self.store.conn:
            row=self.row(identifier)
            if action=='activate':
                if row['pending']:raise UserError('Confira o envio sem confirmação antes de ativar.')
                if row['state']=='active':return
                run=self.run(identifier)
                upcoming=max(next_slot(json.loads(row['times']),now),run['retry_at'] if run else 0)
                self.patch(identifier,state='active',next_run=upcoming,note='Agenda ativa. Aguarde o próximo horário local; eventuais prazos do Telegram serão respeitados.')
            elif action=='pause':
                self.patch(identifier,state='attention' if row['pending'] else 'paused',note='Pausada. Um pedido já enviado ao Telegram pode terminar.')
            elif action=='discard':
                if row['state']=='active' or row['pending']:raise UserError('Pause e confira envios sem confirmação antes de descartar a seleção.')
                self.store.conn.execute("update automation_runs set state='abandoned' where automation_id=? and state='ready'",(identifier,))
                self.patch(identifier,state='paused',note='Seleção pendente descartada. Os envios já confirmados continuam registrados.')
            else:raise UserError('Ação inválida.')

    def new_run(self,identifier,groups,target,now):
        if sum(map(len,groups))>100:raise UserError('Seleção acima de 100 mensagens.')
        with self.store.lock,self.store.conn:
            run=self.store.conn.execute('insert into automation_runs(automation_id,groups_json,target,created_at) values (?,?,?,?)',(identifier,json.dumps(groups),target,now)).lastrowid
            self.patch(identifier,note=f'Execução preparada: {sum(map(len,groups))} mensagens novas; até 100 no total.')
            return self.run(identifier)

    def states(self,identifier,ids):
        with self.store.lock:
            return [self.store.conn.execute('select state from automation_messages where automation_id=? and source_id=?',(identifier,value)).fetchone() for value in ids]

    def reserve(self,identifier,run,ids):
        with self.store.lock,self.store.conn:
            states=self.states(identifier,ids)
            if all(row and row['state']=='sent' for row in states):return False
            if any(states):raise UserError('Existe um envio parcial ou sem confirmação. Confira o destino.')
            self.store.conn.executemany("insert into automation_messages(automation_id,source_id,run_id,state) values (?,?,?,'sending')",[(identifier,value,run) for value in ids])
            return True

    def confirm(self,identifier,run,ids,destinations):
        if len(ids)!=len(destinations) or any(not value for value in destinations):raise UserError('Resposta parcial do Telegram. Confira o destino.')
        with self.store.lock,self.store.conn:
            for value,destination in zip(ids,destinations):
                self.store.conn.execute("update automation_messages set state='sent',destination_id=? where automation_id=? and source_id=? and run_id=?",(destination,identifier,value,run))

    def advance(self,run,cursor,retry_at):
        with self.store.lock,self.store.conn:
            self.store.conn.execute('update automation_runs set cursor=?,retry_at=? where id=?',(cursor,retry_at,run))

    def defer(self,identifier,run,ids,deadline):
        with self.store.lock,self.store.conn:
            self.store.conn.executemany("delete from automation_messages where automation_id=? and source_id=? and run_id=? and state='sending'",[(identifier,value,run) for value in ids])
            self.store.conn.execute('update automation_runs set retry_at=? where id=?',(deadline,run))
            self.patch(identifier,next_run=deadline,note=f"Aguardando Telegram até {datetime.fromtimestamp(deadline).strftime('%d/%m %H:%M:%S')} para continuar a mesma seleção.")

    def complete(self,row,run,now):
        with self.store.lock,self.store.conn:
            self.store.conn.execute("update automation_runs set state='completed' where id=?",(run,))
            self.patch(row['id'],next_run=next_slot(json.loads(row['times']),now),note='Execução concluída. Mensagens confirmadas não serão copiadas novamente.')

    def resolve(self,identifier,decision):
        with self.store.lock,self.store.conn:
            row=self.row(identifier)
            if row['state']!='attention' or not row['pending']:raise UserError('Não há envio sem confirmação para conferir.')
            if decision=='sent':
                self.store.conn.execute("update automation_messages set state='sent' where automation_id=? and state='sending'",(identifier,))
            elif decision=='retry':
                self.store.conn.execute("delete from automation_messages where automation_id=? and state='sending'",(identifier,))
            else:raise UserError('Decisão inválida.')
            self.patch(identifier,state='paused',note='Conferência salva. Ao ativar, a seleção pendente continua no próximo horário.')


class Automation:
    def __init__(self,engine):
        self.engine=engine;self.db=AutomationStore(engine.store)

    async def save(self,source,destination,target,times,authorized,identifier=None):
        if not authorized:raise UserError('Confirme que tem autorização para copiar e alterar os links.')
        times=schedule_times(times);target=destination_url(target)
        async with self.engine.lock:
            tg=await self.engine.connected();src,dst=await self.engine.pair(tg,source,destination)
            me=await tg.get_me()
            result=self.db.save(str(get_peer_id(src)),str(get_peer_id(dst)),src.title,dst.title,me.id,target,times,identifier)
            self.engine.emit('refresh',None)
            return result

    async def tick(self,now=None):
        now=time.time() if now is None else now
        for row in reversed(self.db.rows()):
            if row['state']!='active' or row['next_run']>now:continue
            run=self.db.run(row['id'])
            if run and run['retry_at']>now:continue
            if not run and now-row['next_run']>300:
                self.db.patch(row['id'],next_run=next_slot(json.loads(row['times']),now),note='Horário perdido foi pulado. Não acumulamos envios ao reabrir o aplicativo.')
                self.engine.emit('refresh',None);continue
            try:
                await self.step(row,run,now)
            except asyncio.CancelledError:raise
            except errors.FloodWaitError as reason:
                self.db.patch(row['id'],next_run=now+reason.seconds+1,note='Aguardando limite de leitura do Telegram.')
            except Exception as reason:
                from .engine import safe_error
                pending=self.db.row(row['id'])['pending']
                self.db.patch(row['id'],state='attention',note='Envio sem confirmação. Confira o destino antes de retomar.' if pending else safe_error(reason))
            self.engine.emit('refresh',None)
            break  # One publication per tick; release the engine lock for UI and other jobs.

    async def step(self,row,run,now):
        tg=await self.engine.connected();src,dst=await self.engine.pair(tg,row['source'],row['destination'])
        if (await tg.get_me()).id!=row['owner']:raise UserError('A conta conectada é diferente da conta desta automação.')
        if not run:
            latest=await tg.get_messages(src,limit=1)
            if latest and latest[0].grouped_id and time.time()-latest[0].date.timestamp()<5:
                self.db.patch(row['id'],next_run=now+5,note='Aguardando o álbum recém-chegado terminar antes de selecionar.')
                return
            chosen=await latest_selection(tg.iter_messages(src,max_id=latest[0].id+1,limit=None)) if latest else []
            groups=[]
            for batch in media_batches(chosen):
                ids=[message.id for message in batch];states=self.db.states(row['id'],ids)
                if all(state and state['state']=='sent' for state in states):continue
                if any(states):raise UserError('Álbum parcialmente confirmado. Confira o histórico de envios.')
                if len(batch)>10:raise UserError('Álbum acima de 10 mídias não suportado na automação.')
                for message in batch:prepared(message,row['target'])
                if len(batch)>1 and not all(isinstance(message.media,(types.MessageMediaPhoto,types.MessageMediaDocument)) for message in batch):
                    raise UserError('Álbum com mídia incompatível.')
                groups.append(ids)
            run=self.db.new_run(row['id'],groups,row['target'],now)
        groups=json.loads(run['groups_json'])
        if run['cursor']>=len(groups):
            self.db.complete(row,run['id'],now);return
        ids=groups[run['cursor']]
        messages=await tg.get_messages(src,ids=ids)
        if len(messages)!=len(ids) or any(not isinstance(message,types.Message) or message.id!=value for message,value in zip(messages,ids)):
            raise UserError('Uma mensagem da seleção não está mais disponível. A automação foi pausada para conferência.')
        payloads=[prepared(message,run['target']) for message in messages]
        if self.engine.stopping or self.db.row(row['id'])['state']!='active':return
        if self.db.reserve(row['id'],run['id'],ids):
            try:
                if len(messages)>1:
                    sent=await tg.send_file(dst,[message.media for message in messages],caption=[p['text'] for p in payloads],formatting_entities=[decode_entities(p['entities']) for p in payloads],parse_mode=None)
                elif messages[0].media and not isinstance(messages[0].media,types.MessageMediaWebPage):
                    sent=[await tg.send_file(dst,messages[0].media,caption=payloads[0]['text'],formatting_entities=decode_entities(payloads[0]['entities']),parse_mode=None)]
                else:
                    sent=[await tg.send_message(dst,payloads[0]['text'],formatting_entities=decode_entities(payloads[0]['entities']),parse_mode=None,link_preview=False)]
            except errors.FloodWaitError as reason:
                self.db.defer(row['id'],run['id'],ids,now+reason.seconds+1);return
            if not isinstance(sent,(list,tuple)) or any(message is None for message in sent):
                raise UserError('Envio sem confirmação completa. Confira o destino.')
            self.db.confirm(row['id'],run['id'],ids,[getattr(message,'id',None) for message in sent])
        self.db.advance(run['id'],run['cursor']+1,now+1)
        if run['cursor']+1==len(groups):self.db.complete(row,run['id'],now)
