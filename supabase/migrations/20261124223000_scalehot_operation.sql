begin;

alter table public.sales_events add column product_name text
  check (product_name is null or char_length(product_name) between 1 and 120);

create function public.scalehot_record_product_event(
  p_connection uuid, p_hash text, p_external_id text, p_kind text, p_amount bigint,
  p_net bigint, p_occurred timestamptz, p_product_name text
) returns table (event_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare
  result record;
begin
  select * into result from public.sales_record_event(
    p_connection, p_hash, p_external_id, p_kind, p_amount, p_net, p_occurred
  );
  if result.event_id is not null and p_kind = 'approved' then
    update public.sales_events e set product_name = p_product_name
      where e.id = result.event_id and e.link_id = p_connection and e.product_name is null;
  end if;
  return query select result.event_id, result.outcome;
end;
$$;
revoke all on function public.scalehot_record_product_event(uuid,text,text,text,bigint,bigint,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.scalehot_record_product_event(uuid,text,text,text,bigint,bigint,timestamptz,text)
  to service_role;

create table public.scalehot_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense', 'fee', 'tax', 'meta_tax', 'product')),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  occurred_on date not null,
  cents bigint not null check (cents between 1 and 1000000000000)
);
create index scalehot_costs_owner_date on public.scalehot_costs (user_id, occurred_on desc);
alter table public.scalehot_costs enable row level security;
revoke all on public.scalehot_costs from public, anon;
grant select, insert, update, delete on public.scalehot_costs to authenticated;
create policy scalehot_costs_owner on public.scalehot_costs for all to authenticated
  using ((select auth.uid()) = user_id and (select public.platform_is_approved()))
  with check ((select auth.uid()) = user_id and (select public.platform_is_approved()));

create function public.scalehot_operation_report(p_since date, p_until date, p_campaign text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
begin
  if owner is null or not coalesce(public.platform_is_approved(), false) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if p_since is null or p_until is null or p_until - p_since not between 0 and 92
    or char_length(coalesce(p_campaign, '')) > 400 then
    raise exception 'Invalid report filters' using errcode = '22023';
  end if;
  return (
    with source as (
      select e.kind, e.amount_cents, e.net_cents, e.occurred_at, e.id, e.provider, e.product_name,
        coalesce(nullif(c.campaign_id, ''), nullif(c.utm_campaign, '')) as campaign_key,
        nullif(c.utm_campaign, '') as campaign_name,
        lower(c.utm_source) in ('facebook', 'fb', 'instagram', 'ig', 'meta', 'google', 'googleads', 'adwords')
          and (lower(c.utm_medium) in ('cpc', 'paid', 'paid_social', 'paid_search', 'ppc')
            or nullif(c.campaign_id, '') is not null) as paid_origin
      from public.sales_events e
      left join public.sales_events approval on e.kind <> 'approved' and approval.kind = 'approved'
        and approval.user_id = e.user_id and approval.provider = e.provider and approval.external_id = e.external_id
      left join public.sales_tracking_orders o on o.link_id = coalesce(approval.link_id, e.link_id) and o.external_id = e.external_id
      left join public.sales_tracking_clicks c on c.source_id = o.source_id and c.token_hash = o.token_hash
        and c.created_at between coalesce(approval.occurred_at, e.occurred_at) - interval '168 hours'
          and coalesce(approval.occurred_at, e.occurred_at)
      where e.user_id = owner
        and e.occurred_at >= p_since::timestamp at time zone 'America/Sao_Paulo'
        and e.occurred_at < (p_until + 1)::timestamp at time zone 'America/Sao_Paulo'
    ), filtered as (
      select * from source where p_campaign is null or campaign_key = p_campaign
    ), summary as (
      select count(*) filter (where kind = 'approved') as approved,
        coalesce(sum(amount_cents) filter (where kind = 'approved'), 0) as gross_cents,
        coalesce(sum(amount_cents) filter (where kind = 'reversed'), 0) as reversed_cents,
        count(*) filter (where kind = 'approved' and paid_origin) as paid_sales,
        coalesce(sum(amount_cents) filter (where kind = 'approved' and paid_origin), 0) as paid_gross_cents,
        case when count(*) filter (where kind = 'approved' and net_cents is null) = 0
          then coalesce(sum(net_cents) filter (where kind = 'approved'), 0)
        end as net_cents,
        (select coalesce(sum(c.cents), 0) from public.scalehot_costs c where c.user_id = owner
          and c.kind = 'expense' and c.occurred_on between p_since and p_until) as expense_cents,
        (select coalesce(sum(c.cents), 0) from public.scalehot_costs c where c.user_id = owner
          and c.kind = 'fee' and c.occurred_on between p_since and p_until) as fee_cents,
        (select coalesce(sum(c.cents), 0) from public.scalehot_costs c where c.user_id = owner
          and c.kind = 'tax' and c.occurred_on between p_since and p_until) as tax_cents,
        (select coalesce(sum(c.cents), 0) from public.scalehot_costs c where c.user_id = owner
          and c.kind = 'meta_tax' and c.occurred_on between p_since and p_until) as meta_tax_cents,
        (select coalesce(sum(c.cents), 0) from public.scalehot_costs c where c.user_id = owner
          and c.kind = 'product' and c.occurred_on between p_since and p_until) as product_cost_cents
      from filtered
    ), campaign_totals as (
      select campaign_key as id, coalesce(min(campaign_name), campaign_key) as name,
        count(*) as sales, sum(amount_cents) as gross_cents
      from source where kind = 'approved' and campaign_key is not null
      group by campaign_key order by gross_cents desc, campaign_key limit 50
    ), daily as (
      select (occurred_at at time zone 'America/Sao_Paulo')::date as day,
        sum(case when kind = 'approved' then amount_cents else -amount_cents end) as gross_cents
      from filtered where kind in ('approved', 'reversed') group by 1
    ), products as (
      select product_name as name, count(*) as sales, sum(amount_cents) as gross_cents
      from filtered where kind = 'approved' group by product_name
      order by gross_cents desc, product_name limit 50
    )
    select to_jsonb(s) || jsonb_build_object(
      'campaigns', coalesce((select jsonb_agg(c order by gross_cents desc, id) from campaign_totals c), '[]'::jsonb),
      'series', coalesce((select jsonb_agg(d order by day) from daily d), '[]'::jsonb),
      'products', coalesce((select jsonb_agg(p order by gross_cents desc, name) from products p), '[]'::jsonb)
    ) from summary s
  );
end;
$$;
revoke all on function public.scalehot_operation_report(date,date,text) from public, anon;
grant execute on function public.scalehot_operation_report(date,date,text) to authenticated;

commit;
