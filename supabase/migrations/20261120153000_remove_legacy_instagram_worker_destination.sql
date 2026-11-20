begin;

-- The independent deployment only starts workers against a configured destination.
create or replace function public.enable_instagram_worker()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  destination private.instagram_worker_destination;
  secret_id uuid;
  worker_token text;
begin
  perform pg_catalog.pg_advisory_xact_lock(820261108);
  select * into destination from private.instagram_worker_destination where singleton;
  if not found or not destination.enabled then return false; end if;

  select vault_secret_id into secret_id from private.instagram_worker_auth where singleton;
  if secret_id is null then
    worker_token := pg_catalog.rtrim(
      pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
      '='
    );
    secret_id := vault.create_secret(
      worker_token, '00duhot_instagram_worker', 'Bearer token for Instagram jobs'
    );
    insert into private.instagram_worker_auth(singleton, token_hash, vault_secret_id)
    values (true, pg_catalog.encode(extensions.digest(worker_token, 'sha256'), 'hex'), secret_id);
  elsif not exists (select 1 from vault.decrypted_secrets where id = secret_id) then
    raise exception 'Worker secret is missing from Supabase Vault';
  end if;

  perform private.sync_instagram_worker_jobs(destination.origin, true);
  return true;
end;
$$;

drop function private.initialize_instagram_worker();

-- Pre-existing installations must explicitly choose their own host before resuming.
select cron.alter_job(j.jobid, active := false)
from cron.job j
where j.jobname in ('00duhot-instagram-worker', '00duhot-instagram-analytics')
  and not exists (select 1 from private.instagram_worker_destination where singleton);

commit;
