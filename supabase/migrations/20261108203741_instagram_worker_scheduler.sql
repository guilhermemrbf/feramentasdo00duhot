-- Turn on the existing Supabase Postgres scheduler and its asynchronous HTTP client.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.instagram_worker_auth (
  singleton boolean primary key default true check (singleton),
  token_hash text not null,
  vault_secret_id uuid not null,
  configured_at timestamptz not null default pg_catalog.now()
);
alter table private.instagram_worker_auth enable row level security;
revoke all on table private.instagram_worker_auth from public, anon, authenticated, service_role;

create or replace function public.verify_instagram_worker_secret(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.char_length(p_token) >= 43
    and exists (
      select 1
      from private.instagram_worker_auth
      where singleton
        and token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
    ),
    false
  );
$$;
revoke all on function public.verify_instagram_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_instagram_worker_secret(text) to service_role;

create or replace function public.instagram_worker_is_active()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.instagram_worker_auth a
    join vault.decrypted_secrets s on s.id = a.vault_secret_id
    join cron.job j on j.jobname = '00duhot-instagram-worker' and j.active
    where a.singleton
  );
$$;
revoke all on function public.instagram_worker_is_active() from public, anon, authenticated;
grant execute on function public.instagram_worker_is_active() to service_role;

create or replace function public.enable_instagram_worker()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
  worker_token text;
  job_id bigint;
  job_is_active boolean;
begin

  perform pg_catalog.pg_advisory_xact_lock(820261108);

  select vault_secret_id into secret_id
  from private.instagram_worker_auth
  where singleton;

  if secret_id is null then
    worker_token := pg_catalog.rtrim(
      pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
      '='
    );
    secret_id := vault.create_secret(
      worker_token,
      '00duhot_instagram_worker',
      'Bearer token for the 00duHot Instagram queue worker'
    );
    insert into private.instagram_worker_auth(singleton, token_hash, vault_secret_id)
    values (
      true,
      pg_catalog.encode(extensions.digest(worker_token, 'sha256'), 'hex'),
      secret_id
    );
  elsif not exists (
    select 1 from vault.decrypted_secrets where id = secret_id
  ) then
    raise exception 'Worker secret is missing from Supabase Vault';
  end if;

  select jobid, active into job_id, job_is_active
  from cron.job
  where jobname = '00duhot-instagram-worker';

  if job_id is not null and job_is_active then
    return true;
  end if;

  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    '00duhot-instagram-worker',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://feramentasdo00duhot.lovable.app/api/instagram/worker',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select s.decrypted_secret
            from vault.decrypted_secrets s
            join private.instagram_worker_auth a on a.vault_secret_id = s.id
            where a.singleton
          )
        ),
        timeout_milliseconds := 10000
      );
    $cron$
  );

  return true;
end;
$$;
revoke all on function public.enable_instagram_worker() from public, anon, authenticated;
grant execute on function public.enable_instagram_worker() to service_role;
