-- Short, leased steps: never repeat a media_publish request after an uncertain result.
alter table public.posts
  add column publish_phase text not null default 'create'
    check (publish_phase in ('create', 'waiting', 'publishing', 'done')),
  add column meta_container_id text,
  add column processing_started_at timestamptz,
  add column worker_lease_id uuid,
  add column worker_lease_until timestamptz;

-- The legacy worker did not retain whether it reached media_publish.
update public.posts set status = 'needs_review', last_error_code = 'legacy_processing',
  last_error_message = 'Confira a conta antes de tentar outra publicação.'
where status = 'processing';

-- Disable old worker versions before changing their claim semantics.
revoke execute on function public.claim_due_instagram_posts(integer) from service_role;

create function public.claim_instagram_publish_step()
returns setof public.posts language plpgsql security definer set search_path = '' as $$
declare candidate public.posts;
begin
  -- Serialize the brief claiming transaction, not the network work.
  perform pg_catalog.pg_advisory_xact_lock(6110301);
  update public.posts set status = 'needs_review', worker_lease_id = null,
    worker_lease_until = null, last_error_code = 'publish_interrupted',
    last_error_message = 'A confirmação foi interrompida. Confira a conta antes de publicar novamente.'
  where status = 'processing' and publish_phase = 'publishing'
    and worker_lease_until < pg_catalog.now();

  update public.posts set status = 'failed', worker_lease_id = null,
    worker_lease_until = null, last_error_code = 'processing_expired',
    last_error_message = 'O processamento expirou. Revise o vídeo e prepare um novo agendamento.'
  where status = 'processing' and publish_phase in ('create', 'waiting')
    and processing_started_at < pg_catalog.now() - interval '23 hours'
    and (worker_lease_until is null or worker_lease_until < pg_catalog.now());

  update public.publish_attempts a set
    status = case when p.status = 'needs_review' then 'ambiguous' else 'failed' end,
    error_code = p.last_error_code, error_message = p.last_error_message,
    finished_at = pg_catalog.now()
  from public.posts p where a.post_id = p.id and a.attempt_number = p.attempt_count
    and a.status in ('started', 'processing') and p.status in ('needs_review', 'failed')
    and p.last_error_code in ('publish_interrupted', 'processing_expired', 'legacy_processing');

  select p.* into candidate from public.posts p
  where p.content_type = 'reel'
    and ((p.status = 'scheduled' and p.scheduled_at <= pg_catalog.now())
      or (p.status = 'processing' and p.publish_phase in ('create', 'waiting')
        and coalesce(p.next_attempt_at, p.scheduled_at) <= pg_catalog.now()))
    and (p.worker_lease_until is null or p.worker_lease_until < pg_catalog.now())
    and not exists (select 1 from public.posts active
      where active.instagram_account_id = p.instagram_account_id
        and active.id <> p.id and active.status = 'processing'
        and (active.worker_lease_until > pg_catalog.now() or active.publish_phase = 'publishing'))
  order by coalesce(p.next_attempt_at, p.scheduled_at), p.created_at
  for update of p skip locked limit 1;
  if not found then return; end if;

  update public.posts set status = 'processing', worker_lease_id = gen_random_uuid(),
    worker_lease_until = pg_catalog.now() + interval '2 minutes',
    processing_started_at = coalesce(processing_started_at, pg_catalog.now()),
    attempt_count = attempt_count + 1
  where id = candidate.id returning * into candidate;
  insert into public.publish_attempts(workspace_id, post_id, attempt_number, status, meta_container_id)
  values(candidate.workspace_id, candidate.id, candidate.attempt_count, 'started', candidate.meta_container_id);
  return next candidate;
end;
$$;

create function public.checkpoint_instagram_publish(
  p_post_id uuid, p_lease_id uuid, p_outcome text,
  p_container_id text default null, p_media_id text default null, p_error_code text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare target public.posts; message text;
begin
  select * into target from public.posts where id = p_post_id for update;
  if not found or target.status <> 'processing'
    or target.worker_lease_id is distinct from p_lease_id or p_lease_id is null
    or target.worker_lease_until is null
    or target.worker_lease_until <= pg_catalog.now() then return false; end if;
  if p_outcome not in ('waiting','publishing','published','failed','needs_review') then
    raise exception 'Invalid publishing outcome'; end if;
  if p_outcome in ('waiting','publishing') and nullif(p_container_id, '') is null then
    raise exception 'Container required'; end if;
  if p_outcome = 'publishing' and target.publish_phase <> 'waiting' then
    raise exception 'Container must be ready before publishing'; end if;
  if p_outcome = 'published' and
    (target.publish_phase <> 'publishing' or nullif(p_media_id, '') is null) then
    raise exception 'Publication confirmation required'; end if;
  if target.publish_phase = 'publishing' and p_outcome in ('waiting','publishing','failed') then
    raise exception 'Publication requires confirmation or review'; end if;
  message := case p_outcome
    when 'needs_review' then 'Confira o Instagram: a publicação pode ter sido aceita. Não será repetida automaticamente.'
    when 'failed' then 'Não foi possível preparar a publicação. Revise a conexão e o arquivo.'
    else null end;

  update public.posts set
    status = (case when p_outcome in ('waiting','publishing') then 'processing' else p_outcome end)::public.post_status,
    publish_phase = case p_outcome when 'waiting' then 'waiting' when 'publishing' then 'publishing'
      when 'published' then 'done' else publish_phase end,
    meta_container_id = coalesce(p_container_id, meta_container_id),
    meta_media_id = coalesce(p_media_id, meta_media_id),
    published_at = case when p_outcome = 'published' then pg_catalog.now() else published_at end,
    next_attempt_at = case when p_outcome = 'waiting' then pg_catalog.now() + interval '30 seconds' else null end,
    worker_lease_id = case when p_outcome = 'publishing' then worker_lease_id else null end,
    worker_lease_until = case when p_outcome = 'publishing' then worker_lease_until else null end,
    last_error_code = p_error_code, last_error_message = message
  where id = target.id;

  update public.publish_attempts set
    status = case p_outcome when 'waiting' then 'processing' when 'publishing' then 'processing'
      when 'published' then 'succeeded' when 'needs_review' then 'ambiguous' else 'failed' end,
    meta_container_id = coalesce(p_container_id, meta_container_id), meta_media_id = p_media_id,
    error_code = p_error_code, error_message = message,
    finished_at = case when p_outcome = 'publishing' then null else pg_catalog.now() end
  where post_id = target.id and attempt_number = target.attempt_count;
  return true;
end;
$$;

-- Clients may schedule but cannot invent successful results or release worker leases.
drop policy "editors can manage posts" on public.posts;
create policy "editors can schedule reels" on public.posts for insert to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  and status = 'scheduled' and content_type = 'reel' and scheduled_at > now()
  and publish_phase = 'create' and attempt_count = 0 and meta_container_id is null
  and meta_media_id is null and published_at is null and worker_lease_id is null
  and worker_lease_until is null and processing_started_at is null and next_attempt_at is null
  and exists (select 1 from public.instagram_accounts a where a.id = instagram_account_id
    and a.connection_status = 'connected')
);

create function public.cancel_scheduled_instagram_post(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.posts set status = 'cancelled'
  where id = p_post_id and status = 'scheduled'
    and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]);
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_instagram_publish_step() from public, anon, authenticated;
revoke all on function public.checkpoint_instagram_publish(uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.cancel_scheduled_instagram_post(uuid) from public, anon;
grant execute on function public.claim_instagram_publish_step() to service_role;
grant execute on function public.checkpoint_instagram_publish(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.cancel_scheduled_instagram_post(uuid) to authenticated;
