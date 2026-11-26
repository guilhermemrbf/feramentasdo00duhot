begin;

create table public.syncpay_subscriptions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  plan_token uuid not null,
  billing_method text not null check (billing_method in ('qr_code', 'pix_automatico')),
  request_hash text not null,
  subscription_token uuid unique,
  payment jsonb,
  status text not null default 'enrolling',
  payment_status text not null default 'aguardando',
  next_charge_at timestamptz,
  manually_suspended boolean not null default false,
  command_key uuid,
  command text,
  command_reason text,
  command_lease_until timestamptz,
  closed_at timestamptz,
  checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index syncpay_one_open_subscription
  on public.syncpay_subscriptions(user_id) where closed_at is null;
create index syncpay_subscription_reconciliation
  on public.syncpay_subscriptions(next_check_at)
  where subscription_token is not null and closed_at is null;

create table public.syncpay_webhooks (
  event text primary key,
  provider_id bigint unique not null,
  signing_secret text not null
);

create table public.syncpay_events (
  fingerprint text primary key,
  event text not null,
  subscription_token uuid not null,
  received_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  processed_at timestamptz
);
create index syncpay_events_pending on public.syncpay_events(next_attempt_at)
  where processed_at is null;

create table public.syncpay_worker_state (
  name text primary key,
  available_at timestamptz not null default now(),
  provider_error text
);

alter table public.syncpay_subscriptions enable row level security;
alter table public.syncpay_webhooks enable row level security;
alter table public.syncpay_events enable row level security;
alter table public.syncpay_worker_state enable row level security;
revoke all on public.syncpay_subscriptions, public.syncpay_webhooks,
  public.syncpay_events, public.syncpay_worker_state from public, anon, authenticated;
grant select, insert, update, delete on public.syncpay_subscriptions, public.syncpay_webhooks,
  public.syncpay_events, public.syncpay_worker_state to service_role;

create function public.syncpay_checkout_ready() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) = 3 from public.syncpay_webhooks
  where event in ('cobranca_paga', 'assinatura_ativada', 'assinatura_cancelada');
$$;
revoke all on function public.syncpay_checkout_ready() from public, anon, authenticated;
grant execute on function public.syncpay_checkout_ready() to service_role;

create function private.syncpay_has_access(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.syncpay_subscriptions s
    where s.user_id = p_user and s.subscription_token is not null and s.closed_at is null
      and s.status not in ('suspended', 'cancelled', 'expired')
      and not s.manually_suspended
      and (
        (s.payment_status = 'em_dia' and s.next_charge_at is null)
        or (s.payment_status in ('em_dia', 'pendente')
          and (statement_timestamp() at time zone 'America/Sao_Paulo')::date
              <= (s.next_charge_at at time zone 'America/Sao_Paulo')::date + 7)
      )
  );
$$;
revoke all on function private.syncpay_has_access(uuid) from public, anon, authenticated;

create or replace function private.platform_user_status(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when u.email_confirmed_at is null then 'unverified'
      when exists(select from private.platform_administrators a where a.user_id = u.id) then 'admin'
      when access.decision in ('approved', 'denied') then access.decision
      when private.syncpay_has_access(p_user) then 'approved'
      when access.trial_expires_at > statement_timestamp() and exists (
        select from private.platform_trial_invites i
        where i.id = access.trial_invite_id and i.revoked_at is null
      ) then 'trial'
      when access.trial_expires_at is not null then 'expired'
      else 'pending'
    end
    from auth.users u left join private.platform_access access on access.user_id = u.id
    where u.id = p_user and u.deleted_at is null
  ), 'unverified');
$$;

-- The same worker lease prevents duplicate registrations across Vercel invocations.
insert into public.syncpay_worker_state(name) values ('tick');
do $$
begin
  if not exists(select from vault.decrypted_secrets where name = 'mousefy_syncpay_worker') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mousefy_syncpay_worker');
  end if;
end;
$$;

create function public.syncpay_worker_secret() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'mousefy_syncpay_worker';
$$;
revoke all on function public.syncpay_worker_secret() from public, anon, authenticated;
grant execute on function public.syncpay_worker_secret() to service_role;

select cron.schedule('mousefy-syncpay-subscriptions', '* * * * *', $job$
  select net.http_post(
    url := 'https://mausehot.vercel.app/api/webhooks/syncpay',
    headers := jsonb_build_object('Authorization', 'Bearer ' || public.syncpay_worker_secret(),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 55000
  );
$job$);

commit;
