-- Atomic queue claiming for the Instagram publisher.
-- Apply only after reviewing the target Supabase project and the earlier PostKit migrations.

create or replace function public.claim_due_instagram_posts(p_limit integer default 5)
returns setof public.posts
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A timed-out worker may have sent media_publish before losing its response.
  -- Never automatically requeue those posts: mark them for manual review.
  with stale as (
    update public.posts p
    set status = 'needs_review',
        last_error_code = 'worker_lease_expired',
        last_error_message = 'Worker stopped while publishing; verify Instagram before retrying.',
        updated_at = pg_catalog.now()
    where p.status = 'processing'
      and exists (
        select 1
        from public.publish_attempts a
        where a.post_id = p.id
          and a.attempt_number = p.attempt_count
          and a.status in ('started', 'processing')
          and a.started_at < pg_catalog.now() - interval '15 minutes'
      )
    returning p.id, p.attempt_count
  )
  update public.publish_attempts a
  set status = 'ambiguous',
      error_code = 'worker_lease_expired',
      error_message = 'Worker stopped while publishing; verify Instagram before retrying.',
      finished_at = pg_catalog.now()
  from stale s
  where a.post_id = s.id
    and a.attempt_number = s.attempt_count;

  return query
  with candidates as (
    select p.id
    from public.posts p
    where p.status = 'scheduled'
      and p.scheduled_at <= pg_catalog.now()
    order by p.scheduled_at, p.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ), claimed as (
    update public.posts p
    set status = 'processing',
        attempt_count = p.attempt_count + 1,
        next_attempt_at = null,
        updated_at = pg_catalog.now()
    from candidates c
    where p.id = c.id
    returning p.*
  ), opened_attempts as (
    insert into public.publish_attempts (workspace_id, post_id, attempt_number, status)
    select c.workspace_id, c.id, c.attempt_count, 'started'
    from claimed c
    returning post_id
  )
  select c.*
  from claimed c
  join opened_attempts a on a.post_id = c.id;
end;
$$;

revoke all on function public.claim_due_instagram_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_due_instagram_posts(integer) to service_role;
