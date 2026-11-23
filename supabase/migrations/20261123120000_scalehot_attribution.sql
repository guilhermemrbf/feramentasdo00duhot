alter table public.sales_webhook_links
  add constraint sales_webhook_links_id_owner_unique unique (id, user_id);

create table public.sales_tracking_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_id uuid not null,
  origin text not null check (length(origin) between 9 and 255 and origin like 'https://%'),
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, link_id),
  foreign key (link_id, user_id) references public.sales_webhook_links (id, user_id) on delete cascade
);
create index sales_tracking_sources_owner on public.sales_tracking_sources (user_id, created_at desc);
create unique index sales_tracking_active_origin on public.sales_tracking_sources (link_id, origin) where active;

create table public.sales_tracking_clicks (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  source_id uuid not null references public.sales_tracking_sources(id) on delete cascade,
  utm_source text check (length(utm_source) <= 120),
  utm_medium text check (length(utm_medium) <= 120),
  utm_campaign text check (length(utm_campaign) <= 120),
  campaign_id text check (campaign_id ~ '^[0-9]{1,32}$'),
  ad_id text check (ad_id ~ '^[0-9]{1,32}$'),
  created_at timestamptz not null default now(),
  check (utm_source is not null or campaign_id is not null or ad_id is not null),
  unique (source_id, token_hash)
);
create index sales_tracking_clicks_source_time on public.sales_tracking_clicks (source_id, created_at);

create table public.sales_tracking_orders (
  link_id uuid not null,
  external_id text not null check (length(external_id) between 1 and 160),
  source_id uuid not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  primary key (link_id, external_id),
  foreign key (source_id, link_id) references public.sales_tracking_sources (id, link_id) on delete cascade,
  foreign key (source_id, token_hash) references public.sales_tracking_clicks (source_id, token_hash) on delete cascade
);
create index sales_tracking_orders_source on public.sales_tracking_orders (source_id, token_hash);

alter table public.sales_tracking_sources enable row level security;
alter table public.sales_tracking_clicks enable row level security;
alter table public.sales_tracking_orders enable row level security;
revoke all on public.sales_tracking_sources, public.sales_tracking_clicks, public.sales_tracking_orders from public, anon, authenticated;
grant select, insert, update on public.sales_tracking_sources to service_role;

create function public.sales_tracking_capture(
  p_source uuid, p_secret text, p_token text, p_utm_source text, p_utm_medium text,
  p_utm_campaign text, p_campaign_id text, p_ad_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.sales_tracking_sources s
    join public.sales_webhook_links l on l.id = s.link_id
    where s.id = p_source and s.active and l.active and s.secret_hash = p_secret
      and public.platform_approved_user(s.user_id)
    for share of l, s;
  if not found then return false; end if;
  insert into public.sales_tracking_clicks
    (token_hash, source_id, utm_source, utm_medium, utm_campaign, campaign_id, ad_id)
  values (p_token, p_source, p_utm_source, p_utm_medium, p_utm_campaign, p_campaign_id, p_ad_id);
  return true;
end;
$$;

create function public.sales_tracking_bind(p_source uuid, p_secret text, p_token text, p_external_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  gateway uuid;
  existing_token text;
begin
  select s.link_id into gateway from public.sales_tracking_sources s
    join public.sales_webhook_links l on l.id = s.link_id
    where s.id = p_source and s.active and l.active and s.secret_hash = p_secret
      and public.platform_approved_user(s.user_id)
    for share of l, s;
  if not found then return 'unauthorized'; end if;

  select token_hash into existing_token from public.sales_tracking_orders
    where link_id = gateway and external_id = p_external_id;
  if found then
    return case when existing_token = p_token then 'bound' else 'conflict' end;
  end if;

  perform 1 from public.sales_tracking_clicks
    where token_hash = p_token and source_id = p_source and created_at > now() - interval '168 hours';
  if not found then return 'invalid_click'; end if;

  insert into public.sales_tracking_orders (link_id, external_id, source_id, token_hash)
    values (gateway, p_external_id, p_source, p_token)
    on conflict (link_id, external_id) do nothing;
  select token_hash into existing_token from public.sales_tracking_orders
    where link_id = gateway and external_id = p_external_id;
  return case when existing_token = p_token then 'bound' else 'conflict' end;
end;
$$;

create function public.sales_tracking_overview() returns jsonb
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select auth.uid() as user_id where public.platform_is_approved()
  ), sales as (
    select e.id, e.amount_cents, c.token_hash, c.utm_source, c.utm_medium, c.utm_campaign,
      c.campaign_id, c.ad_id, coalesce(r.amount_cents, 0) as reversed_cents
    from allowed a
    join public.sales_events e on e.user_id = a.user_id
    left join public.sales_tracking_orders o on o.link_id = e.link_id and o.external_id = e.external_id
    left join public.sales_tracking_clicks c on c.token_hash = o.token_hash and c.source_id = o.source_id
      and c.created_at between e.occurred_at - interval '168 hours' and e.occurred_at
    left join public.sales_events r on r.user_id = e.user_id and r.provider = e.provider
      and r.external_id = e.external_id and r.kind = 'reversed'
    where e.kind = 'approved' and e.occurred_at >= now() - interval '30 days'
  ), campaigns as (
    select utm_source as source, utm_medium as medium, utm_campaign as campaign, campaign_id, ad_id,
      count(*) as sales, sum(amount_cents) as gross_cents, sum(reversed_cents) as reversed_cents
    from sales where token_hash is not null
    group by utm_source, utm_medium, utm_campaign, campaign_id, ad_id
    order by gross_cents desc, campaign_id, ad_id, utm_source, utm_medium, utm_campaign limit 50
  ), sources as (
    select s.id, s.origin, s.link_id, l.label, l.active as gateway_active, s.active, s.created_at,
      (select max(c.created_at) from public.sales_tracking_clicks c where c.source_id = s.id) as last_click_at
    from allowed a
    join public.sales_tracking_sources s on s.user_id = a.user_id
    join public.sales_webhook_links l on l.id = s.link_id
  )
  select jsonb_build_object(
    'approved', (select count(*) from sales),
    'attributed', (select count(token_hash) from sales),
    'unattributed', (select count(*) - count(token_hash) from sales),
    'campaigns', coalesce((select jsonb_agg(c order by c.gross_cents desc, c.campaign_id, c.ad_id, c.source, c.medium, c.campaign) from campaigns c), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(s order by s.active desc, s.created_at desc) from sources s), '[]'::jsonb)
  );
$$;

revoke all on function public.sales_tracking_capture(uuid,text,text,text,text,text,text,text),
  public.sales_tracking_bind(uuid,text,text,text), public.sales_tracking_overview()
  from public, anon, authenticated;
grant execute on function public.sales_tracking_capture(uuid,text,text,text,text,text,text,text),
  public.sales_tracking_bind(uuid,text,text,text) to service_role;
grant execute on function public.sales_tracking_overview() to authenticated;
