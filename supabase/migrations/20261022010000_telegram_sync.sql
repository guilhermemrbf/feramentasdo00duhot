-- Private service tables: browser clients have no direct mutation access.
create table public.tg_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, session_ciphertext text not null, created_at timestamptz not null default now()
);
create table public.tg_sync_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null references public.tg_connections(id) on delete cascade,
 source text not null, destination text not null, source_title text not null, destination_title text not null,
 mode text not null check (mode in ('history','continuous')), status text not null default 'running' check(status in ('running','paused','cancelled','completed','attention')),
 rules jsonb not null default '[]', authorized_at timestamptz not null default now(),
 checkpoint bigint not null default 0, until_id bigint not null, processed bigint not null default 0,
 error text, next_run timestamptz not null default now(), created_at timestamptz not null default now(),
 check(source <> destination)
);
create table public.tg_message_map (
 job_id uuid not null references public.tg_sync_jobs(id) on delete cascade,
 source_id bigint not null, destination_ids jsonb, state text not null check(state in ('sending','sent','skipped')),
 primary key(job_id,source_id), created_at timestamptz not null default now()
);
create table public.tg_audit_logs (
 id bigint generated always as identity primary key, job_id uuid not null references public.tg_sync_jobs(id) on delete cascade,
 event text not null, created_at timestamptz not null default now()
);
create index tg_jobs_due on public.tg_sync_jobs(next_run) where status='running';
create index tg_jobs_owner on public.tg_sync_jobs(user_id,created_at);
alter table public.tg_connections enable row level security;
alter table public.tg_sync_jobs enable row level security;
alter table public.tg_message_map enable row level security;
alter table public.tg_audit_logs enable row level security;
revoke all on public.tg_connections,public.tg_sync_jobs,public.tg_message_map,public.tg_audit_logs from anon,authenticated;
-- The Python service uses a dedicated server-only database connection.
-- Defense in depth: a job cannot reference another tenant's connection.
alter table public.tg_connections add constraint tg_connection_owner unique(id,user_id);
alter table public.tg_sync_jobs add constraint tg_job_connection_owner foreign key(connection_id,user_id) references public.tg_connections(id,user_id) on delete cascade;
alter table public.tg_sync_jobs add constraint tg_rules_array check(jsonb_typeof(rules)='array');
create unique index tg_active_pair on public.tg_sync_jobs(user_id,source,destination) where status in ('running','paused','attention');
