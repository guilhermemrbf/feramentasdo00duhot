begin;

create table private.instagram_worker_destination (
  singleton boolean primary key default true check (singleton),
  origin text not null,
  enabled boolean not null
);
alter table private.instagram_worker_destination enable row level security;
revoke all on table private.instagram_worker_destination from public, anon, authenticated, service_role;

create function private.sync_instagram_worker_jobs(p_origin text, p_active boolean)
returns void language plpgsql set search_path = '' as $$
declare
  worker_job record;
  target_url text;
  command text;
  job_id bigint;
begin
  for worker_job in
    select * from (values
      ('00duhot-instagram-worker', '', 'Bearer ', 10000),
      ('00duhot-instagram-analytics', '?job=analytics', 'Analytics ', 25000)
    ) as jobs(name, query, prefix, timeout)
  loop
    target_url := p_origin || '/api/instagram/worker' || worker_job.query;
    command := pg_catalog.format($job$
      select net.http_post(
        url := %L,
        body := '{}'::jsonb,
        headers := pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json', 'Authorization', %L || s.decrypted_secret
        ),
        timeout_milliseconds := %s
      )
      from vault.decrypted_secrets s
      join private.instagram_worker_auth a on a.vault_secret_id = s.id
      where a.singleton;
    $job$, target_url, worker_job.prefix, worker_job.timeout);

    select j.jobid into job_id from cron.job j where j.jobname = worker_job.name;
    if job_id is null then
      job_id := cron.schedule(worker_job.name, '* * * * *', command);
    end if;
    perform cron.alter_job(job_id, command := command, active := p_active);
  end loop;
end;
$$;
revoke all on function private.sync_instagram_worker_jobs(text,boolean)
  from public, anon, authenticated, service_role;

-- Preserve the original Vault and token initialization for both hosting paths.
alter function public.enable_instagram_worker() set schema private;
alter function private.enable_instagram_worker() rename to initialize_instagram_worker;
revoke all on function private.initialize_instagram_worker() from public, anon, authenticated, service_role;

create function public.enable_instagram_worker()
returns boolean language plpgsql security definer set search_path = '' as $$
declare destination private.instagram_worker_destination;
begin
  perform pg_catalog.pg_advisory_xact_lock(820261108);
  select * into destination from private.instagram_worker_destination where singleton;
  if destination.enabled is false then return false; end if;
  if not private.initialize_instagram_worker() then return false; end if;
  if destination.origin is not null then
    perform private.sync_instagram_worker_jobs(destination.origin, true);
  end if;
  return true;
end;
$$;
revoke all on function public.enable_instagram_worker() from public, anon, authenticated;
grant execute on function public.enable_instagram_worker() to service_role;

-- Run as the database operator. Staging defaults to both jobs paused.
create function private.configure_instagram_worker_destination(p_origin text, p_active boolean default false)
returns void language plpgsql set search_path = '' as $$
begin
  if p_origin is null or p_active is null or pg_catalog.length(p_origin) > 262
      or p_origin !~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'
  then raise exception 'Expected an HTTPS origin without a path' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(820261108);
  insert into private.instagram_worker_destination(singleton, origin, enabled)
  values (true, p_origin, p_active)
  on conflict (singleton) do update set origin = excluded.origin, enabled = excluded.enabled;
  if p_active then
    if not public.enable_instagram_worker() then
      raise exception 'Could not activate Instagram worker';
    end if;
  else
    perform private.sync_instagram_worker_jobs(p_origin, false);
  end if;
end;
$$;
revoke all on function private.configure_instagram_worker_destination(text,boolean)
  from public, anon, authenticated, service_role;

commit;
