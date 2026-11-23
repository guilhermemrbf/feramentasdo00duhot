create table public.sales_meta_ads_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_hash text unique check (state_hash is null or state_hash ~ '^[a-f0-9]{64}$'),
  state_expires_at timestamptz,
  state_claimed_at timestamptz,
  app_id text check (app_id is null or app_id ~ '^[0-9]{1,32}$'),
  token_ciphertext text,
  token_expires_at timestamptz,
  accounts jsonb not null default '[]'::jsonb check (jsonb_typeof(accounts) = 'array'),
  connected_at timestamptz
);
alter table public.sales_meta_ads_connections enable row level security;
revoke all on public.sales_meta_ads_connections from public, anon, authenticated;
grant select, insert, update, delete on public.sales_meta_ads_connections to service_role;

create function public.sales_meta_ads_claim_state(p_hash text) returns uuid
language sql security definer set search_path = '' as $$
  update public.sales_meta_ads_connections
    set state_claimed_at = now()
    where state_hash = p_hash and state_expires_at > now() and state_claimed_at is null
      and public.platform_approved_user(user_id)
    returning user_id;
$$;

create function public.sales_meta_ads_finish_state(
  p_owner uuid, p_hash text, p_app text, p_token text, p_expiry timestamptz, p_accounts jsonb
) returns boolean language sql security definer set search_path = '' as $$
  with updated as (
    update public.sales_meta_ads_connections
      set state_hash = null, state_expires_at = null, state_claimed_at = null,
        app_id = p_app, token_ciphertext = p_token, token_expires_at = p_expiry,
        accounts = p_accounts, connected_at = now()
      where user_id = p_owner and state_hash = p_hash and state_claimed_at is not null
        and state_expires_at > now() and p_expiry > now() and public.platform_approved_user(user_id)
      returning user_id
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.sales_meta_ads_claim_state(text),
  public.sales_meta_ads_finish_state(uuid,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.sales_meta_ads_claim_state(text),
  public.sales_meta_ads_finish_state(uuid,text,text,text,timestamptz,jsonb) to service_role;
