begin;

create table public.sales_google_ads_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_hash text unique check (state_hash is null or state_hash ~ '^[a-f0-9]{64}$'),
  state_expires_at timestamptz,
  state_claimed_at timestamptz,
  client_id text,
  refresh_ciphertext text,
  accounts jsonb not null default '[]'::jsonb check (jsonb_typeof(accounts) = 'array'),
  connected_at timestamptz
);
alter table public.sales_google_ads_connections enable row level security;
revoke all on public.sales_google_ads_connections from public, anon, authenticated;
grant select, insert, update, delete on public.sales_google_ads_connections to service_role;

create function public.sales_google_ads_claim_state(p_hash text) returns uuid
language sql security definer set search_path = '' as $$
  update public.sales_google_ads_connections
    set state_claimed_at = now()
    where state_hash = p_hash and state_expires_at > now() and state_claimed_at is null
      and public.platform_approved_user(user_id)
    returning user_id;
$$;

create function public.sales_google_ads_finish_state(
  p_owner uuid, p_hash text, p_client text, p_refresh text, p_accounts jsonb
) returns boolean language sql security definer set search_path = '' as $$
  with updated as (
    update public.sales_google_ads_connections
      set state_hash = null, state_expires_at = null, state_claimed_at = null,
        client_id = p_client, refresh_ciphertext = p_refresh,
        accounts = p_accounts, connected_at = now()
      where user_id = p_owner and state_hash = p_hash and state_claimed_at is not null
        and state_expires_at > now() and public.platform_approved_user(user_id)
      returning user_id
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.sales_google_ads_claim_state(text),
  public.sales_google_ads_finish_state(uuid,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.sales_google_ads_claim_state(text),
  public.sales_google_ads_finish_state(uuid,text,text,text,jsonb) to service_role;

create table public.sales_google_conversion_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  destination text not null check (destination ~ '^AW-[0-9]{1,20}/[A-Za-z0-9_-]{1,100}$'),
  created_at timestamptz not null default now(),
  unique (user_id, destination)
);
alter table public.sales_google_conversion_tags enable row level security;
revoke all on public.sales_google_conversion_tags from public, anon, authenticated;
grant select, insert, delete on public.sales_google_conversion_tags to service_role;

commit;
