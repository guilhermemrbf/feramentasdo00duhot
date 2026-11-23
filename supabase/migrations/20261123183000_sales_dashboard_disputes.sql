begin;
set local lock_timeout = '5s';

-- A contestation is visible before any financial reversal is confirmed.
alter table public.sales_events
  drop constraint sales_events_kind_check,
  add constraint sales_events_kind_check check (kind in ('approved','reversed','disputed')) not valid;

create or replace function public.sales_overview(p_days integer, p_provider text default null, p_period text default null) returns jsonb
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
    from events where kind in ('approved','reversed') group by 1
  ), monthly as (
    select date_trunc('month', occurred_at at time zone 'America/Sao_Paulo')::date as month,
      sum(case when kind = 'approved' then amount_cents else -amount_cents end) as gross,
      case when count(*) filter (where kind = 'approved' and net_cents is null) = 0
        then sum(net_cents) filter (where kind = 'approved')
      end as net
    from events where kind in ('approved','reversed') group by 1 order by 1 desc limit 6
  )
  select jsonb_build_object(
    'approved', count(*) filter (where kind = 'approved'),
    'gross_cents', coalesce(sum(amount_cents) filter (where kind = 'approved'), 0),
    'reversed_cents', coalesce(sum(amount_cents) filter (where kind = 'reversed'), 0),
    'reversed', count(*) filter (where kind = 'reversed'),
    'refund_or_dispute_count', count(distinct (provider,external_id))
      filter (where kind in ('reversed','disputed')),
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

create or replace function public.scalehot_meta_record_syncpay(
  p_pixel uuid,p_secret text,p_reference uuid,p_type text,p_amount numeric,p_net numeric,p_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  result text;
  gateway_hash text;
begin
  select user_id into owner from public.scalehot_meta_pixels where id=p_pixel and syncpay_secret=p_secret and active and public.platform_approved_user(user_id) for share;
  if not found then return 'unauthorized'; end if;
  if p_type is null or p_type not in ('cashin','refund','dispute') or p_amount <= 0 or p_at is null then return 'invalid'; end if;
  -- Serialize approval and refund for the same provider reference, including different endpoints.
  perform pg_advisory_xact_lock(hashtextextended(owner::text || ':' || p_reference::text,0));
  -- Pixel and gateway share an ID. The gateway credential is independent of checkout access.
  insert into public.sales_webhook_links(id,user_id,provider,label,secret_hash)
    select id,user_id,'syncpay',label,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
      from public.scalehot_meta_pixels where id=p_pixel
    on conflict(id) do nothing;
  select secret_hash into gateway_hash from public.sales_webhook_links
    where id=p_pixel and provider='syncpay' and user_id=owner;
  select outcome into result from public.sales_record_event(p_pixel,gateway_hash,p_reference::text,
    case p_type when 'refund' then 'reversed' when 'dispute' then 'disputed' else 'approved' end,
    round(p_amount*100)::bigint,
    case when p_type<>'dispute' then round(p_net*100)::bigint end,p_at);
  if result not in ('duplicate','recorded') then return 'unauthorized'; end if;
  if p_type='refund' then
    update public.scalehot_meta_sales set refunded=true
      where user_id=owner and reference_id=p_reference;
  elsif p_type='cashin' then
    insert into public.scalehot_meta_sales(pixel_id,user_id,reference_id,amount,paid_at,refunded)
      values (p_pixel,owner,p_reference,p_amount,p_at,exists (
        select 1 from public.sales_events where user_id=owner and provider='syncpay'
          and external_id=p_reference::text and kind='reversed'
      )) on conflict (user_id,reference_id) do nothing;
  end if;
  return result;
end;
$$;

commit;

alter table public.sales_events validate constraint sales_events_kind_check;
