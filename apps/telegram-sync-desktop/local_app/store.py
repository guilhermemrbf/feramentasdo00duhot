import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from .domain import UserError, validate_rules


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, path):
        self.path = Path(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript('''
            pragma journal_mode=WAL;
            pragma foreign_keys=ON;
            create table if not exists settings (key text primary key, value text not null);
            create table if not exists jobs (
                id integer primary key, source text not null, destination text not null,
                source_title text not null, destination_title text not null,
                mode text not null check(mode in ('history','continuous')),
                status text not null default 'paused', rules text not null,
                checkpoint integer not null default 0, until_id integer not null,
                processed integer not null default 0, error text,
                next_run real not null default 0, authorized_at text not null,
                created_at text not null, check(source <> destination));
            create table if not exists messages (
                job_id integer not null references jobs(id) on delete cascade,
                source_id integer not null, state text not null,
                destination_ids text not null default '[]', primary key(job_id,source_id));
            create table if not exists logs (
                id integer primary key, job_id integer references jobs(id) on delete cascade,
                event text not null, created_at text not null);
        ''')
        # A prior process can have died after a send but before confirmation.
        with self.lock, self.conn:
            self.conn.execute("update jobs set status='attention',error='Envio sem confirmação. Confira o destino antes de decidir a recuperação.' where id in (select job_id from messages where state='sending') and status not in ('completed','cancelled')")
            self.conn.execute("update jobs set status='paused' where status='running'")

    def close(self):
        with self.lock:
            self.conn.close()

    def setting(self, key):
        with self.lock:
            row = self.conn.execute('select value from settings where key=?', (key,)).fetchone()
            return row['value'] if row else ''

    def save_rules(self, rules):
        rules = validate_rules(rules)
        with self.lock, self.conn:
            self.conn.execute("insert or replace into settings(key,value) values ('rules',?)", (json.dumps(rules),))

    def save_account(self, sealed):
        with self.lock, self.conn:
            self.conn.execute("insert or replace into settings(key,value) values ('account',?)", (sealed,))

    def clear_account(self):
        with self.lock, self.conn:
            if self.conn.execute("select 1 from jobs where status in ('running','paused','attention')").fetchone():
                raise UserError('Cancele as tarefas pendentes antes de desconectar.')
            self.conn.execute("delete from settings where key='account'")

    def jobs(self):
        with self.lock:
            return [dict(row) for row in self.conn.execute('select * from jobs order by id desc')]

    def job(self, job_id):
        with self.lock:
            row = self.conn.execute('select * from jobs where id=?', (job_id,)).fetchone()
            if not row:
                raise UserError('Tarefa não encontrada.')
            return dict(row)

    def create(self, source, destination, source_title, destination_title, mode, rules, until_id):
        if mode not in ('history','continuous') or source == destination:
            raise UserError('Origem, destino ou modo inválidos.')
        rules = validate_rules(rules)
        with self.lock, self.conn:
            edges = self.conn.execute("select source,destination from jobs where status in ('running','paused','attention')").fetchall()
            pending, visited = [destination], set()
            while pending:
                node = pending.pop()
                if node == source:
                    raise UserError('Esta tarefa criaria um ciclo de publicações.')
                if node not in visited:
                    visited.add(node)
                    pending.extend(edge['destination'] for edge in edges if edge['source'] == node)
            if any(edge['source'] == source and edge['destination'] == destination for edge in edges):
                raise UserError('Já existe uma tarefa pendente para estes canais.')
            cursor = self.conn.execute('insert into jobs(source,destination,source_title,destination_title,mode,rules,until_id,authorized_at,created_at) values (?,?,?,?,?,?,?,?,?)',
                (source,destination,source_title,destination_title,mode,json.dumps(rules),until_id,now(),now()))
            job_id = cursor.lastrowid
            self.log(job_id,'Tarefa criada, pausada. Clique em Iniciar para publicar.')
            return job_id

    def control(self, job_id, action):
        with self.lock, self.conn:
            row = self.job(job_id)
            if row['status'] in ('completed','cancelled'):
                raise UserError('Esta tarefa já foi encerrada.')
            if action == 'start' and row['status'] == 'attention' and self.pending(job_id):
                raise UserError('Confira e resolva o envio pendente antes de retomar.')
            status = {'start':'running','pause':'paused','cancel':'cancelled'}.get(action)
            if not status:
                raise UserError('Ação inválida.')
            self.conn.execute('update jobs set status=?,next_run=0 where id=?', (status,job_id))
            self.log(job_id, {'start':'Sincronização iniciada.','pause':'Tarefa pausada.','cancel':'Tarefa cancelada.'}[action])

    def patch(self, job_id, **values):
        allowed = {'status','error','checkpoint','next_run'}
        if not values or set(values)-allowed:
            raise ValueError('Invalid job update')
        with self.lock, self.conn:
            self.conn.execute('update jobs set '+','.join(key+'=?' for key in values)+' where id=?', (*values.values(),job_id))

    def reserve(self, job_id, ids):
        with self.lock, self.conn:
            existing = [self.conn.execute('select state from messages where job_id=? and source_id=?', (job_id,value)).fetchone() for value in ids]
            if all(row and row['state'] in ('sent','skipped') for row in existing):
                return False
            if any(existing):
                raise UserError('Existe um envio sem confirmação. Revise a publicação no destino.')
            self.conn.executemany("insert into messages(job_id,source_id,state) values (?,?,'sending')", [(job_id,value) for value in ids])
            return True

    def confirm(self, job_id, ids, destination_ids):
        if destination_ids and len(destination_ids) != len(ids):
            raise UserError('Quantidade de mensagens enviada divergiu. Confira o destino.')
        with self.lock, self.conn:
            for index, value in enumerate(ids):
                dest = [destination_ids[index]] if destination_ids else []
                self.conn.execute('update messages set state=?,destination_ids=? where job_id=? and source_id=?', ('sent' if dest else 'skipped', json.dumps(dest),job_id,value))
            self.conn.execute('update jobs set checkpoint=?,processed=processed+? where id=?', (ids[-1],len(ids),job_id))

    def advance_confirmed(self, job_id, ids):
        with self.lock, self.conn:
            self.conn.execute('update jobs set checkpoint=max(checkpoint,?) where id=?', (ids[-1],job_id))

    def defer(self, job_id, ids, seconds):
        """Only for a definitive Telegram FloodWait rejection, never a timeout."""
        import time
        with self.lock, self.conn:
            self.conn.executemany("delete from messages where job_id=? and source_id=? and state='sending'", [(job_id,value) for value in ids])
            self.conn.execute("update jobs set next_run=?,error='Aguardando limite do Telegram.' where id=?", (time.time()+seconds+1,job_id))

    def pending(self, job_id):
        with self.lock:
            return [row['source_id'] for row in self.conn.execute("select source_id from messages where job_id=? and state='sending' order by source_id", (job_id,))]

    def resolve_pending(self, job_id, decision):
        with self.lock, self.conn:
            row = self.job(job_id)
            ids = self.pending(job_id)
            if row['status'] != 'attention' or not ids:
                raise UserError('Não há envio sem confirmação para resolver.')
            if decision == 'sent':
                # IDs unknown: record an operator-confirmed outcome, never fabricate destination IDs.
                self.conn.execute("update messages set state='sent' where job_id=? and state='sending'", (job_id,))
                self.conn.execute("update jobs set checkpoint=max(checkpoint,?),processed=processed+?,status='paused',error=null where id=?", (max(ids),len(ids),job_id))
            elif decision == 'retry':
                self.conn.execute("delete from messages where job_id=? and state='sending'", (job_id,))
                self.conn.execute("update jobs set status='paused',error=null where id=?", (job_id,))
            else:
                raise UserError('Decisão inválida.')
            self.log(job_id, 'Conferência manual: '+('publicação confirmada pelo operador.' if decision=='sent' else 'operador autorizou nova tentativa; risco de duplicação conferido.'))

    def log(self, job_id, event):
        with self.lock, self.conn:
            self.conn.execute('insert into logs(job_id,event,created_at) values (?,?,?)', (job_id,event,now()))
            self.conn.execute('delete from logs where id not in (select id from logs order by id desc limit 2000)')

    def logs(self):
        with self.lock:
            return [dict(row) for row in self.conn.execute('select * from logs order by id desc limit 100')]

    def message_counts(self):
        """Confirmed outcomes, not ID differences or the legacy processed count."""
        with self.lock:
            rows=self.conn.execute('select job_id,state,count(*) as total from messages group by job_id,state')
            result={}
            for row in rows:
                result.setdefault(row['job_id'],{'sent':0,'skipped':0,'sending':0})[row['state']]=row['total']
            return result
