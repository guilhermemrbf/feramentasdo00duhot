create table public.scalehot_meta_pixels (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  dataset_id text not null check (dataset_id ~ '^[0-9]{1,32}$'),
  checkout_origin text not null check (checkout_origin like 'https://%'),
  checkout_key_hash text not null unique check (checkout_key_hash ~ '^[a-f0-9]{64}$'),
  meta_token text not null,
  syncpay_secret text,
  test_event_code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index scalehot_meta_pixels_owner on public.scalehot_meta_pixels (user_id, created_at desc);

create table public.scalehot_meta_clicks (
  pixel_id uuid not null references public.scalehot_meta_pixels on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  campaign_id text check (campaign_id ~ '^[0-9]{1,32}$'),
  adset_id text check (adset_id ~ '^[0-9]{1,32}$'),
  ad_id text check (ad_id ~ '^[0-9]{1,32}$'),
  fbc text check (length(fbc) <= 600),
  created_at timestamptz not null default now(),
  primary key (pixel_id, token_hash)
);

create table public.scalehot_meta_orders (
  pixel_id uuid not null,
  reference_id uuid not null,
  token_hash text not null,
  source_url text not null check (length(source_url) <= 2048 and source_url like 'https://%'),
  primary key (pixel_id, reference_id),
  foreign key (pixel_id, token_hash) references public.scalehot_meta_clicks on delete cascade
);

create table public.scalehot_meta_sales (
  id uuid primary key default gen_random_uuid(),
  pixel_id uuid not null references public.scalehot_meta_pixels on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  reference_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null,
  refunded boolean not null default false,
  state text not null default 'pending' check (state in ('pending','sent','test_sent','failed')),
  lease uuid,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  unique (user_id, reference_id)
);
create index scalehot_meta_sales_owner on public.scalehot_meta_sales (user_id, paid_at desc);
create index scalehot_meta_sales_queue on public.scalehot_meta_sales (next_attempt_at) where state = 'pending' and not refunded;

alter table public.scalehot_meta_pixels enable row level security;
alter table public.scalehot_meta_clicks enable row level security;
alter table public.scalehot_meta_orders enable row level security;
alter table public.scalehot_meta_sales enable row level security;
revoke all on public.scalehot_meta_pixels, public.scalehot_meta_clicks, public.scalehot_meta_orders,
  public.scalehot_meta_sales from public, anon, authenticated;
grant select, insert, update on public.scalehot_meta_pixels to service_role;

create function public.scalehot_meta_capture(p_pixel uuid,p_key text,p_hash text,p_campaign text,p_adset text,p_ad text,p_fbc text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.scalehot_meta_pixels where id=p_pixel and checkout_key_hash=p_key and active and public.platform_approved_user(user_id) for share;
  if not found then return false; end if;
  insert into public.scalehot_meta_clicks(pixel_id,token_hash,campaign_id,adset_id,ad_id,fbc)
    values (p_pixel,p_hash,p_campaign,p_adset,p_ad,p_fbc);
  return true;
end;
$$;

create function public.scalehot_meta_bind(p_pixel uuid,p_key text,p_hash text,p_reference uuid,p_url text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  existing text;
begin
  perform 1 from public.scalehot_meta_pixels where id=p_pixel and checkout_key_hash=p_key and active and public.platform_approved_user(user_id) for share;
  if not found then return 'unauthorized'; end if;
  select token_hash into existing from public.scalehot_meta_orders where pixel_id=p_pixel and reference_id=p_reference;
  if found then return case when existing=p_hash then 'bound' else 'conflict' end; end if;
  perform 1 from public.scalehot_meta_clicks
    where pixel_id=p_pixel and token_hash=p_hash and created_at >= now()-interval '168 hours';
  if not found then return 'invalid_click'; end if;
  insert into public.scalehot_meta_orders(pixel_id,reference_id,token_hash,source_url) values (p_pixel,p_reference,p_hash,p_url)
    on conflict (pixel_id,reference_id) do nothing;
  select token_hash into existing from public.scalehot_meta_orders where pixel_id=p_pixel and reference_id=p_reference;
  return case when existing=p_hash then 'bound' else 'conflict' end;
end;
$$;

create function public.scalehot_meta_record_syncpay(
  p_pixel uuid,p_secret text,p_reference uuid,p_type text,p_amount numeric,p_net numeric,p_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  result text;
  gateway_hash text;
begin
  select user_id into owner from public.scalehot_meta_pixels where id=p_pixel and syncpay_secret=p_secret and active and public.platform_approved_user(user_id) for share;
  if not found then return 'unauthorized'; end if;
  if p_type not in ('cashin','refund') or p_amount <= 0 or p_at is null then return 'invalid'; end if;
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
    case when p_type='refund' then 'reversed' else 'approved' end,
    round(p_amount*100)::bigint,round(p_net*100)::bigint,p_at);
  if result not in ('duplicate','recorded') then return 'unauthorized'; end if;
  if p_type='refund' then
    update public.scalehot_meta_sales set refunded=true
      where user_id=owner and reference_id=p_reference;
  else

    insert into public.scalehot_meta_sales(pixel_id,user_id,reference_id,amount,paid_at,refunded)
      values (p_pixel,owner,p_reference,p_amount,p_at,exists (
        select 1 from public.sales_events where user_id=owner and provider='syncpay'
          and external_id=p_reference::text and kind='reversed'
      )) on conflict (user_id,reference_id) do nothing;
  end if;
  return result;
end;
$$;

create function public.scalehot_meta_claim()
returns table (
  id uuid, lease uuid, pixel_id uuid, dataset_id text, meta_token text, test_event_code text,
  amount numeric, paid_at timestamptz, fbc text, source_url text
) language sql security definer set search_path = '' as $$
  with candidates as (
    select s.id, p.dataset_id, p.meta_token, p.test_event_code, c.fbc, o.source_url
    from public.scalehot_meta_sales s join public.scalehot_meta_pixels p on p.id=s.pixel_id
    join public.scalehot_meta_orders o on o.pixel_id=s.pixel_id and o.reference_id=s.reference_id
    join public.scalehot_meta_clicks c on c.pixel_id=o.pixel_id and c.token_hash=o.token_hash
    where p.active and public.platform_approved_user(p.user_id) and s.state='pending' and not s.refunded and c.fbc is not null
      and s.next_attempt_at <= now() and s.attempts < 6
      and s.paid_at >= now()-interval '168 hours'
      and c.created_at between s.paid_at-interval '168 hours' and s.paid_at
    order by s.next_attempt_at,s.id limit 8 for update of s skip locked
  )
  update public.scalehot_meta_sales s set lease=gen_random_uuid(), attempts=s.attempts+1,
    next_attempt_at=now()+interval '2 minutes'
  from candidates c where s.id=c.id
  returning s.id,s.lease,s.pixel_id,c.dataset_id,c.meta_token,c.test_event_code,s.amount,s.paid_at,c.fbc,c.source_url;
$$;

create function public.scalehot_meta_finish(p_id uuid,p_lease uuid,p_state text)
returns void language sql security definer set search_path = '' as $$
  update public.scalehot_meta_sales
    set state=case when p_state in ('sent','test_sent') then p_state when p_state='retry' and attempts<6 then 'pending' else 'failed' end,
      lease=null, next_attempt_at=now()+make_interval(mins=>least(60,1 << least(attempts,6)))
    where id=p_id and lease=p_lease;
$$;

create function public.scalehot_meta_report(p_from timestamptz,p_until timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with sales as (
    select s.*,c.token_hash,c.campaign_id,c.ad_id,c.fbc
    from public.scalehot_meta_sales s
    left join public.scalehot_meta_orders o on o.pixel_id=s.pixel_id and o.reference_id=s.reference_id
    left join public.scalehot_meta_clicks c on c.pixel_id=o.pixel_id and c.token_hash=o.token_hash
      and c.created_at between s.paid_at-interval '168 hours' and s.paid_at
    where public.platform_is_approved() and s.user_id=auth.uid() and (p_from is null or s.paid_at>=p_from) and (p_until is null or s.paid_at<p_until)
  ), campaigns as (
    select campaign_id,ad_id,count(*) as sales,sum(amount) as gross
    from sales where token_hash is not null and not refunded
    group by campaign_id,ad_id order by gross desc,campaign_id,ad_id limit 30
  )
  select jsonb_build_object(
    'approved', count(*) filter (where not refunded),
    'attributed', count(token_hash) filter (where not refunded),
    'revenue', coalesce(sum(amount) filter (where token_hash is not null and not refunded),0),
    'sent', count(*) filter (where state='sent'),
    'test_sent', count(*) filter (where state='test_sent'),
    'failed', count(*) filter (where not refunded and token_hash is not null and fbc is not null
      and (state='failed' or (state='pending' and (paid_at<now()-interval '168 hours' or (attempts>=6 and next_attempt_at<=now()))))),
    'campaigns', coalesce((select jsonb_agg(c order by c.gross desc,c.campaign_id,c.ad_id) from campaigns c),'[]'::jsonb)
  ) from sales;
$$;

revoke all on function public.scalehot_meta_capture(uuid,text,text,text,text,text,text),
  public.scalehot_meta_bind(uuid,text,text,uuid,text),public.scalehot_meta_record_syncpay(uuid,text,uuid,text,numeric,numeric,timestamptz),
  public.scalehot_meta_claim(),public.scalehot_meta_finish(uuid,uuid,text),public.scalehot_meta_report(timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.scalehot_meta_capture(uuid,text,text,text,text,text,text),
  public.scalehot_meta_bind(uuid,text,text,uuid,text),public.scalehot_meta_record_syncpay(uuid,text,uuid,text,numeric,numeric,timestamptz),
  public.scalehot_meta_claim(),public.scalehot_meta_finish(uuid,uuid,text) to service_role;
grant execute on function public.scalehot_meta_report(timestamptz,timestamptz) to authenticated;
