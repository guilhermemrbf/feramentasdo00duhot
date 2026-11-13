begin;
-- Invoker rights preserve existing posts/media workspace policies and triggers.
create or replace function public.schedule_reviewed_instagram_reels(
  p_workspace_id uuid, p_account_id uuid, p_posts jsonb, p_stories text, p_confirmed boolean
) returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare tz text; inserted integer;
begin
  if auth.uid() is null or not coalesce(public.has_workspace_role(p_workspace_id, array['owner','admin','editor']::public.workspace_role[]), false) then
    raise exception 'workspace_access';
  end if;
  if p_confirmed is distinct from true or p_stories is null or p_stories not in ('skip','planned') then
    raise exception 'review_required';
  end if;
  if p_posts is null or jsonb_typeof(p_posts) <> 'array' or jsonb_array_length(p_posts) not between 1 and 1000 then
    raise exception 'invalid_batch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  perform 1 from public.instagram_accounts where id=p_account_id and workspace_id=p_workspace_id
    and connection_status='connected';
  if not found then raise exception 'account_not_connected'; end if;
  select timezone into tz from public.workspaces where id=p_workspace_id;
  if p_stories='planned' and not exists(select 1 from public.instagram_story_reminders
    where workspace_id=p_workspace_id and instagram_account_id=p_account_id and state='pending'
      and scheduled_at > now()) then raise exception 'stories_required'; end if;
  if exists(select 1 from jsonb_array_elements(p_posts) p where
      (p->>'instagram_account_id')::uuid is distinct from p_account_id or
      (p->>'workspace_id')::uuid is distinct from p_workspace_id or
      (p->>'scheduled_at')::timestamptz is null or (p->>'scheduled_at')::timestamptz <= now() or
      p->>'idempotency_key' is null or char_length(coalesce(p->>'caption','')) > 2200 or
      not exists(select 1 from public.media_assets m where m.id=(p->>'media_asset_id')::uuid
        and m.workspace_id=p_workspace_id and m.reel_account_id=p_account_id and m.archived_at is null
        and m.status in ('uploaded','ready') and m.mime_type in ('video/mp4','video/quicktime')) or
      (p->>'cover_asset_id' is not null and not exists(select 1 from public.media_assets c
        where c.id=(p->>'cover_asset_id')::uuid and c.workspace_id=p_workspace_id and c.mime_type='image/jpeg'))
    ) then raise exception 'invalid_account_media_or_schedule'; end if;
  if exists(
    select 1 from (
      select (p->>'scheduled_at')::timestamptz at time zone tz as moment from jsonb_array_elements(p_posts) p
      where not exists(select 1 from public.posts old where old.idempotency_key=(p->>'idempotency_key')::uuid)
      union all select scheduled_at at time zone tz from public.posts where instagram_account_id=p_account_id
        and workspace_id=p_workspace_id and content_type='reel' and status in ('scheduled','processing','needs_review','published')
    ) days where moment::date in (select ((p->>'scheduled_at')::timestamptz at time zone tz)::date from jsonb_array_elements(p_posts) p) group by moment::date having count(*) > 10
  ) then raise exception 'daily_limit_exceeded'; end if;
  insert into public.posts (workspace_id,instagram_account_id,media_asset_id,content_type,caption,hashtags,
    scheduled_at,timezone,status,idempotency_key,cover_asset_id,first_comment,created_by)
  select p_workspace_id,p_account_id,(p->>'media_asset_id')::uuid,'reel',coalesce(p->>'caption',''),
    array(select jsonb_array_elements_text(coalesce(p->'hashtags','[]'::jsonb))),
    (p->>'scheduled_at')::timestamptz,tz,'scheduled'::public.post_status,(p->>'idempotency_key')::uuid,
    (p->>'cover_asset_id')::uuid,nullif(p->>'first_comment',''),auth.uid()
  from jsonb_array_elements(p_posts) p on conflict (idempotency_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.schedule_reviewed_instagram_reels(uuid,uuid,jsonb,text,boolean) from public,anon;
grant execute on function public.schedule_reviewed_instagram_reels(uuid,uuid,jsonb,text,boolean) to authenticated;
commit;
