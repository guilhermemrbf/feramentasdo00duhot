begin;

create table public.instagram_drive_sources (
  account_id uuid primary key,
  workspace_id uuid not null,
  folder_id text not null,
  folder_name text not null,
  library_folder_id uuid not null default gen_random_uuid(),
  foreign key (account_id, workspace_id) references public.instagram_accounts (id, workspace_id) on delete cascade
);

create table public.instagram_drive_files (
  media_asset_id uuid primary key,
  workspace_id uuid not null,
  account_id uuid not null,
  folder_id text not null,
  file_id text not null,
  revision text not null,
  checksum text not null,
  size_bytes bigint not null check (size_bytes between 1 and 50000000),
  unique (account_id, folder_id, file_id, revision),
  foreign key (media_asset_id, workspace_id) references public.media_assets (id, workspace_id) on delete cascade,
  foreign key (account_id, workspace_id) references public.instagram_accounts (id, workspace_id) on delete cascade
);

create table public.instagram_drive_staging (
  path text primary key,
  post_id uuid not null,
  expires_at timestamptz not null default (now() + interval '2 hours')
);
create index instagram_drive_staging_expiry_idx on public.instagram_drive_staging (expires_at);
create index instagram_drive_staging_post_idx on public.instagram_drive_staging (post_id);

alter table public.instagram_drive_sources enable row level security;
alter table public.instagram_drive_files enable row level security;
alter table public.instagram_drive_staging enable row level security;
revoke all on public.instagram_drive_sources, public.instagram_drive_files, public.instagram_drive_staging
  from public, anon, authenticated;
grant select, insert, update, delete on public.instagram_drive_sources to service_role;
grant select, insert on public.instagram_drive_files to service_role;
grant select, insert, delete on public.instagram_drive_staging to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postkit-drive-staging', 'postkit-drive-staging', false, 50000000, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- Only the server may register a Drive reference in the publishing library.
create policy "only server creates Reel Drive references"
on public.media_assets as restrictive for insert to authenticated
with check (storage_path not like 'drive/%');
create policy "only server edits Reel Drive references"
on public.media_assets as restrictive for update to authenticated
using (storage_path not like 'drive/%')
with check (storage_path not like 'drive/%');
create policy "only server deletes Reel Drive references"
on public.media_assets as restrictive for delete to authenticated
using (storage_path not like 'drive/%');

create function public.sync_instagram_drive_library(
  p_workspace uuid, p_account uuid, p_actor uuid, p_folder text, p_name text,
  p_files jsonb, p_connect boolean
) returns integer language plpgsql security definer set search_path = '' as $$
declare folder public.instagram_drive_sources;
begin
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace and (
      w.owner_id = p_actor or exists (
        select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = p_actor
        and m.role in ('owner', 'admin', 'editor')
      )
    )
  ) or not exists (
    select 1 from public.instagram_accounts
    where id = p_account and workspace_id = p_workspace and connection_status = 'connected'
  ) then raise exception 'drive_access' using errcode = '42501'; end if;

  if p_folder !~ '^[A-Za-z0-9_-]{10,120}$' or p_folder is null
     or p_name is null or length(p_name) not between 1 and 180
     or p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 1000
  then raise exception 'drive_invalid_source' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account::text, 849170));
  if p_connect then
    insert into public.instagram_drive_sources(account_id, workspace_id, folder_id, folder_name)
      values(p_account, p_workspace, p_folder, p_name) on conflict (account_id) do nothing;
  end if;
  select * into folder from public.instagram_drive_sources
    where account_id = p_account and workspace_id = p_workspace and folder_id = p_folder;
  if not found then raise exception 'drive_source_changed'; end if;

  update public.instagram_drive_sources set folder_name = p_name where account_id = p_account;
  with incoming as materialized (
    select
      coalesce(existing.media_asset_id, gen_random_uuid()) as asset_id,
      existing.media_asset_id is null as is_new,
      item.file_id, item.revision, item.checksum, item.size_bytes, item.filename, item.mime,
      row_number() over (order by item.filename, item.file_id)::int as position
    from jsonb_to_recordset(p_files)
      as item(file_id text, revision text, checksum text, size_bytes bigint, filename text, mime text)
    left join public.instagram_drive_files existing on existing.account_id = p_account
      and existing.folder_id = p_folder and existing.file_id = item.file_id
      and existing.revision = item.revision
  ), updated as (
    insert into public.media_assets(
      id, workspace_id, uploaded_by, original_filename, storage_path, mime_type,
      size_bytes, status, reel_account_id, import_batch_id, import_folder, import_position
    )
    select asset_id, p_workspace, p_actor, filename, 'drive/' || asset_id::text, mime, size_bytes,
      'ready', p_account, folder.library_folder_id, 'Drive · ' || p_name, position from incoming
    on conflict (id) do update set original_filename = excluded.original_filename,
      import_folder = excluded.import_folder, import_position = excluded.import_position, archived_at = null
    returning id
  )
  insert into public.instagram_drive_files(media_asset_id, workspace_id, account_id, folder_id,
    file_id, revision, checksum, size_bytes)
  select asset_id, p_workspace, p_account, p_folder, file_id, revision, checksum, size_bytes
    from incoming join updated on updated.id = incoming.asset_id where is_new;

  update public.media_assets m set archived_at = now()
  from public.instagram_drive_files f
  where f.media_asset_id = m.id and f.workspace_id = p_workspace and f.account_id = p_account
    and m.archived_at is null and (f.folder_id <> p_folder or not exists (
      select 1 from jsonb_to_recordset(p_files) as current_file(file_id text, revision text)
      where current_file.file_id = f.file_id and current_file.revision = f.revision
    ));
  return jsonb_array_length(p_files);
end;
$$;

create function public.disconnect_instagram_drive_library(p_workspace uuid, p_account uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace and (
      w.owner_id = p_actor or exists (
        select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = p_actor
        and m.role in ('owner', 'admin', 'editor')
      )
    )
  ) then raise exception 'drive_access' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account::text, 849170));
  delete from public.instagram_drive_sources where workspace_id = p_workspace and account_id = p_account;
  update public.media_assets m set archived_at = now() from public.instagram_drive_files f
  where f.media_asset_id = m.id and f.workspace_id = p_workspace and f.account_id = p_account
    and m.archived_at is null;
end;
$$;

revoke all on function public.sync_instagram_drive_library(uuid,uuid,uuid,text,text,jsonb,boolean)
  from public, anon, authenticated;
revoke all on function public.disconnect_instagram_drive_library(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.sync_instagram_drive_library(uuid,uuid,uuid,text,text,jsonb,boolean) to service_role;
grant execute on function public.disconnect_instagram_drive_library(uuid,uuid,uuid) to service_role;

-- The worker streams at most one scheduled Drive file per lease.
create or replace function private.sync_instagram_worker_jobs(p_origin text, p_active boolean)
returns void language plpgsql set search_path = '' as $$
declare
  worker_job record;
  command text;
  job_id bigint;
begin
  for worker_job in
    select * from (values
      ('00duhot-instagram-worker', '/worker', 'Bearer ', 90000, '* * * * *', p_active),
      ('00duhot-instagram-analytics', '/worker?job=analytics', 'Analytics ', 25000, '* * * * *', p_active),
      ('00duhot-instagram-drive-cleanup', '/drive-cleanup', 'Bearer ', 20000, '*/15 * * * *',
        exists (select 1 from private.instagram_worker_auth where singleton))
    ) as jobs(name, path, prefix, timeout, schedule, should_run)
  loop
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
    $job$, p_origin || '/api/instagram' || worker_job.path,
      worker_job.prefix, worker_job.timeout);
    select j.jobid into job_id from cron.job j where j.jobname = worker_job.name;
    if job_id is null then
      job_id := cron.schedule(worker_job.name, worker_job.schedule, command);
    end if;
    perform cron.alter_job(job_id, command := command, active := worker_job.should_run);
  end loop;
end;
$$;

-- Reconfigure the existing destination without starting a paused publication queue.
do $$
declare
  destination text;
  publishing_active boolean;
  analytics_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(820261108);
  select origin into destination from private.instagram_worker_destination where singleton;
  if destination is null then return; end if;
  select active into publishing_active from cron.job where jobname = '00duhot-instagram-worker';
  select active into analytics_active from cron.job where jobname = '00duhot-instagram-analytics';
  perform private.sync_instagram_worker_jobs(destination, false);
  perform cron.alter_job(jobid, active := coalesce(publishing_active, false))
    from cron.job where jobname = '00duhot-instagram-worker';
  perform cron.alter_job(jobid, active := coalesce(analytics_active, false))
    from cron.job where jobname = '00duhot-instagram-analytics';
end;
$$;

commit;
