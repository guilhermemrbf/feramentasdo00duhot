create table public.sales_webhook_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('omegapay','syncpay','wiinpay','hotmart','kiwify','monetizze','pepper','custom')),
  label text not null check (length(label) between 1 and 80),
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  provider_hash text check (provider_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_event_at timestamptz,
  check (provider <> 'hotmart' or provider_hash is not null)
);
create index sales_webhook_links_owner on public.sales_webhook_links (user_id, created_at desc);

create table public.sales_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_id uuid not null references public.sales_webhook_links(id) on delete cascade,
  provider text not null,
  external_id text not null check (length(external_id) between 1 and 160),
  kind text not null check (kind in ('approved','reversed')),
  amount_cents bigint not null check (amount_cents between 1 and 1000000000000),
  net_cents bigint check (net_cents between 0 and 1000000000000),
  occurred_at timestamptz not null,
  unique (user_id, provider, external_id, kind)
);
create index sales_events_owner_date on public.sales_events (user_id, occurred_at desc, id);

create table public.sales_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_cents bigint not null check (monthly_cents between 0 and 1000000000000)
);

create table public.sales_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  public_key text not null,
  auth_key text not null,
  notify_approved boolean not null default true,
  notify_since timestamptz not null default now(),
  registered_at timestamptz not null default now(),
  last_test_at timestamptz
);
create index sales_push_devices_owner on public.sales_push_devices (user_id);

create table public.sales_push_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sales_events(id) on delete cascade,
  device_id uuid not null references public.sales_push_devices(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sent','failed')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  next_attempt timestamptz not null default now(),
  lease_id uuid,
  unique (event_id, device_id)
);
create index sales_push_outbox_pending on public.sales_push_outbox (next_attempt) where state = 'pending';

alter table public.sales_webhook_links enable row level security;
alter table public.sales_events enable row level security;
alter table public.sales_goals enable row level security;
alter table public.sales_push_devices enable row level security;
alter table public.sales_push_outbox enable row level security;
revoke all on public.sales_webhook_links, public.sales_events, public.sales_goals, public.sales_push_devices, public.sales_push_outbox
  from public, anon, authenticated;
grant select, insert, update on public.sales_webhook_links to service_role;
grant select, insert, update, delete on public.sales_push_devices to service_role;
grant select, insert, update on public.sales_goals to service_role;

create function public.sales_overview(p_days integer, p_provider text default null, p_period text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  month_start date := date_trunc('month', today::timestamp)::date;
  first_day date;
  last_day date := today + 1;
  snapshot jsonb;
begin
  if owner is null or not coalesce(public.platform_is_approved(), false) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7, 30, 90) then raise exception 'Invalid period'; end if;
  if p_period is not null and p_period not in ('today', 'yesterday', '7d', '30d', 'month', '2m', 'all') then
    raise exception 'Invalid period';
  end if;
  first_day := case p_period
    when 'today' then today
    when 'yesterday' then today - 1
    when '7d' then today - 6
    when '30d' then today - 29
    when 'month' then month_start
    when '2m' then (month_start - interval '1 month')::date
    when 'all' then '-infinity'::date
    else today - (p_days - 1)
  end;
  if p_period = 'yesterday' then last_day := today; end if;
  with events as (
    select e.* from public.sales_events e
    where e.user_id = owner and (p_provider is null or e.provider = p_provider)
      and e.occurred_at >= first_day::timestamp at time zone 'America/Sao_Paulo'
      and e.occurred_at < last_day::timestamp at time zone 'America/Sao_Paulo'
  ), daily as (
    select (occurred_at at time zone 'America/Sao_Paulo')::date as day,
      sum(case when kind = 'approved' then amount_cents else -amount_cents end) as cents
    from events group by 1
  ), monthly as (
    select date_trunc('month', occurred_at at time zone 'America/Sao_Paulo')::date as month,
      sum(case when kind = 'approved' then amount_cents else -amount_cents end) as gross,
      case when count(*) filter (where kind = 'approved' and net_cents is null) = 0
        then sum(net_cents) filter (where kind = 'approved')
      end as net
    from events group by 1 order by 1 desc limit 6
  )
  select jsonb_build_object(
    'approved', count(*) filter (where kind = 'approved'),
    'gross_cents', coalesce(sum(amount_cents) filter (where kind = 'approved'), 0),
    'reversed_cents', coalesce(sum(amount_cents) filter (where kind = 'reversed'), 0),
    'reversed', count(*) filter (where kind = 'reversed'),
    'reported_net_cents', sum(net_cents) filter (where kind = 'approved'),
    'with_net', count(net_cents) filter (where kind = 'approved'),
    'series', case when p_period is null then
      (select jsonb_agg(jsonb_build_object('day', first_day + series.n, 'cents', coalesce(d.cents, 0)) order by series.n)
        from generate_series(0, p_days - 1) series(n) left join daily d on d.day = first_day + series.n)
      else (select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb)
        from (select * from daily order by day desc limit 62) d) end,
    'monthly', (select coalesce(jsonb_agg(to_jsonb(m) order by m.month), '[]'::jsonb) from monthly m),
    'goal_cents', (select g.monthly_cents from public.sales_goals g where g.user_id = owner),
    'month_gross_cents', (select coalesce(sum(e.amount_cents), 0) from public.sales_events e
      where e.user_id = owner and e.kind = 'approved'
        and e.occurred_at >= month_start::timestamp at time zone 'America/Sao_Paulo'
        and e.occurred_at < (today + 1)::timestamp at time zone 'America/Sao_Paulo'),
    'recent', (select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc, e.id), '[]'::jsonb) from (
      select ev.id, ev.provider, ev.external_id, ev.kind, ev.amount_cents, ev.occurred_at
      from events ev order by ev.occurred_at desc, ev.id limit 20
    ) e),
    'links', (select coalesce(jsonb_agg(to_jsonb(link) order by link.created_at desc), '[]'::jsonb) from (
      select l.id, l.provider, l.label, l.active, l.created_at, l.last_event_at
      from public.sales_webhook_links l where l.user_id = owner order by l.created_at desc limit 50
    ) link),
    'devices', (select count(*) from public.sales_push_devices d where d.user_id = owner)
  ) into snapshot from events;
  return snapshot;
end;
$$;
revoke all on function public.sales_overview(integer,text,text) from public, anon;
grant execute on function public.sales_overview(integer,text,text) to authenticated;

create function public.sales_record_event(
  p_connection uuid, p_hash text, p_external_id text, p_kind text, p_amount bigint,
  p_net bigint, p_occurred timestamptz
) returns table (event_id uuid, outcome text)
language plpgsql security definer set search_path = ''
as $$
declare
  connection public.sales_webhook_links%rowtype;
  event uuid;
begin
  select * into connection from public.sales_webhook_links
   where id = p_connection and secret_hash = p_hash and active for update;
  if not found or not coalesce(public.platform_approved_user(connection.user_id), false) then
    return query select null::uuid, 'unauthorized'::text;
    return;
  end if;
  insert into public.sales_events (user_id, link_id, provider, external_id, kind, amount_cents, net_cents, occurred_at)
  values (connection.user_id, connection.id, connection.provider, p_external_id, p_kind, p_amount, p_net,
    least(coalesce(p_occurred, now()), now()))
  on conflict (user_id, provider, external_id, kind) do nothing returning id into event;
  if event is null then
    select e.id into event from public.sales_events e where e.user_id = connection.user_id
      and e.provider = connection.provider and e.external_id = p_external_id and e.kind = p_kind;
    return query select event, 'duplicate'::text;
    return;
  end if;
  update public.sales_webhook_links set last_event_at = now() where id = connection.id;
  if p_kind = 'approved' then
    insert into public.sales_push_outbox (event_id, device_id)
    select event, d.id from public.sales_push_devices d
    where d.user_id = connection.user_id and d.notify_approved
    order by d.registered_at desc limit 10;
  end if;
  return query select event, 'recorded'::text;
end;
$$;

create function public.sales_claim_push(p_event uuid default null)
returns table (job_id uuid, lease uuid, sale_id uuid, endpoint text, public_key text, auth_key text)
language sql security definer set search_path = ''
as $$
  with candidates as (
    select o.id from public.sales_push_outbox o
    join public.sales_events e on e.id = o.event_id
    join public.sales_push_devices d on d.id = o.device_id and d.notify_approved
      and o.created_at >= d.notify_since
    where o.state = 'pending' and o.next_attempt <= now()
      and (p_event is null or o.event_id = p_event)
      and o.attempts < 6 and public.platform_approved_user(e.user_id)
    order by o.next_attempt limit 20 for update of o skip locked
  ), claimed as (
    update public.sales_push_outbox o
    set attempts = o.attempts + 1, lease_id = gen_random_uuid(), next_attempt = now() + interval '2 minutes'
    from candidates c where o.id = c.id returning o.*
  )
  select c.id, c.lease_id, c.event_id, d.endpoint, d.public_key, d.auth_key
  from claimed c join public.sales_push_devices d on d.id = c.device_id;
$$;

create function public.sales_finish_push(p_job uuid, p_lease uuid, p_result text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_result = 'expired' then
    delete from public.sales_push_devices d using public.sales_push_outbox o
    where o.id = p_job and o.lease_id = p_lease and o.device_id = d.id;
  else
    update public.sales_push_outbox
    set state = case when p_result = 'sent' then 'sent'
      when p_result = 'retry' and attempts < 6 then 'pending' else 'failed' end,
      lease_id = null, next_attempt = now() + (attempts * interval '1 minute')
    where id = p_job and lease_id = p_lease;
  end if;
end;
$$;

revoke all on function public.sales_record_event(uuid,text,text,text,bigint,bigint,timestamptz),
  public.sales_claim_push(uuid), public.sales_finish_push(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.sales_record_event(uuid,text,text,text,bigint,bigint,timestamptz),
  public.sales_claim_push(uuid), public.sales_finish_push(uuid,uuid,text) to service_role;
