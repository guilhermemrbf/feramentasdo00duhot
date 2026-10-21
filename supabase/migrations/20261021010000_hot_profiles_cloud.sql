-- Cloud data is accessible only through authenticated server functions.
-- No direct client table grants, including encrypted secrets and provider identifiers.
create table public.hot_cloud_proxies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  protocol text not null check (protocol in ('http','https','socks5')),
  host text not null, port integer not null check (port between 1 and 65535),
  username text not null default '', password_ciphertext text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,id)
);
create index hot_cloud_proxies_owner on public.hot_cloud_proxies(user_id,created_at);
create table public.hot_cloud_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('browser','android')),
  name text not null check (char_length(name) between 1 and 80),
  tags jsonb not null default '[]', notes text not null default '',
  proxy_id uuid, viewport jsonb not null default '{"width":1280,"height":800}',
  context_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,id),
  foreign key (user_id,proxy_id) references public.hot_cloud_proxies(user_id,id) on delete restrict
);
create index hot_cloud_profiles_owner on public.hot_cloud_profiles(user_id,created_at);
create index hot_cloud_profiles_proxy on public.hot_cloud_profiles(user_id,proxy_id);
create table public.hot_cloud_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null, kind text not null check (kind in ('browser','android')),
  provider_id text,
  status text not null default 'starting' check(status in ('starting','running','stopping','stopped','attention')),
  error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (user_id,profile_id) references public.hot_cloud_profiles(user_id,id) on delete restrict
);
create unique index hot_cloud_one_active_session on public.hot_cloud_sessions(profile_id) where status <> 'stopped';
create index hot_cloud_sessions_owner on public.hot_cloud_sessions(user_id,created_at desc);
create index hot_cloud_sessions_profile on public.hot_cloud_sessions(user_id,profile_id);

alter table public.hot_cloud_proxies enable row level security;
alter table public.hot_cloud_profiles enable row level security;
alter table public.hot_cloud_sessions enable row level security;
revoke all on public.hot_cloud_proxies, public.hot_cloud_profiles, public.hot_cloud_sessions from anon,authenticated;
grant all on public.hot_cloud_proxies, public.hot_cloud_profiles, public.hot_cloud_sessions to service_role;

-- Serialize account mutations so start/edit/delete cannot race, even across server instances.
create function public.hot_cloud_mutate(p_owner uuid,p_action text,p_id uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare result jsonb; target public.hot_cloud_profiles; proxy public.hot_cloud_proxies;
begin
  perform pg_advisory_xact_lock(hashtextextended('hot-cloud:'||p_owner::text,0));
  if p_action in ('save-proxy','create-proxy') then
    if p_action = 'create-proxy' then
      if p_id is null or exists(select 1 from hot_cloud_proxies where id=p_id) then raise exception 'HOT_NOT_FOUND'; end if;
    elsif p_id is not null then
      select * into proxy from hot_cloud_proxies where id=p_id and user_id=p_owner for update;
      if not found then raise exception 'HOT_NOT_FOUND'; end if;
      if exists(select 1 from hot_cloud_profiles p join hot_cloud_sessions s on s.profile_id=p.id where p.proxy_id=p_id and s.status<>'stopped') then raise exception 'HOT_BUSY'; end if;
    end if;
    insert into hot_cloud_proxies(id,user_id,name,protocol,host,port,username,password_ciphertext)
    values(coalesce(p_id,gen_random_uuid()),p_owner,p_data->>'name',p_data->>'protocol',p_data->>'host',(p_data->>'port')::int,p_data->>'username',
      case when (p_data->>'clearPassword')::boolean then null else coalesce(p_data->>'password_ciphertext',proxy.password_ciphertext) end)
    on conflict(id) do update set name=excluded.name,protocol=excluded.protocol,host=excluded.host,port=excluded.port,username=excluded.username,password_ciphertext=excluded.password_ciphertext,updated_at=now()
    returning jsonb_build_object('id',id) into result;
  elsif p_action in ('save-profile','delete-profile','start') then
    if p_id is not null then
      select * into target from hot_cloud_profiles where id=p_id and user_id=p_owner for update;
      if not found then raise exception 'HOT_NOT_FOUND'; end if;
      if exists(select 1 from hot_cloud_sessions where profile_id=p_id and status<>'stopped') then raise exception 'HOT_BUSY'; end if;
    end if;
    if p_action='save-profile' then
      if target.kind is not null and target.kind<>p_data->>'kind' then raise exception 'HOT_KIND'; end if;
      insert into hot_cloud_profiles(id,user_id,kind,name,tags,notes,proxy_id,viewport)
      values(coalesce(p_id,gen_random_uuid()),p_owner,p_data->>'kind',p_data->>'name',p_data->'tags',p_data->>'notes',(p_data->>'proxy_id')::uuid,p_data->'viewport')
      on conflict(id) do update set name=excluded.name,tags=excluded.tags,notes=excluded.notes,proxy_id=excluded.proxy_id,viewport=excluded.viewport,updated_at=now()
      returning jsonb_build_object('id',id) into result;
    elsif p_action='start' then
      if target.updated_at <> (p_data->>'expectedProfile')::timestamptz then raise exception 'HOT_STALE'; end if;
      if target.proxy_id is not null and not exists(select 1 from hot_cloud_proxies where id=target.proxy_id and user_id=p_owner and updated_at=(p_data->>'expectedProxy')::timestamptz) then raise exception 'HOT_STALE'; end if;
      if (select count(*) from hot_cloud_sessions where user_id=p_owner and status<>'stopped') >= 4 then raise exception 'HOT_LIMIT'; end if;
      if (select count(*) from hot_cloud_sessions where user_id=p_owner and created_at>now()-interval '1 hour') >= 20 then raise exception 'HOT_RATE'; end if;
      insert into hot_cloud_sessions(user_id,profile_id,kind) values(p_owner,p_id,target.kind) returning to_jsonb(hot_cloud_sessions.*) into result;
    else
      delete from hot_cloud_sessions where profile_id=p_id and user_id=p_owner;
      delete from hot_cloud_profiles where id=p_id and user_id=p_owner;
      result := '{}'::jsonb;
    end if;
  elsif p_action='delete-proxy' then
    if exists(select 1 from hot_cloud_profiles where proxy_id=p_id and user_id=p_owner) then raise exception 'HOT_PROXY_IN_USE'; end if;
    delete from hot_cloud_proxies where id=p_id and user_id=p_owner;
    if not found then raise exception 'HOT_NOT_FOUND'; end if;
    result := '{}'::jsonb;
  else raise exception 'HOT_ACTION';
  end if;
  return result;
end $$;
revoke all on function public.hot_cloud_mutate(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hot_cloud_mutate(uuid,text,uuid,jsonb) to service_role;

-- Realtime/viewer tokens are deliberately never persisted in these tables.
