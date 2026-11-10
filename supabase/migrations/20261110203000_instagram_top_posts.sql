begin;

alter table private.instagram_analytics_media
  add column likes bigint check (likes >= 0),
  add column comments bigint check (comments >= 0);

create or replace function public.finish_instagram_analytics(p_account uuid, p_lease uuid, p_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  job private.instagram_analytics_sync%rowtype;
  problem text := p_result->>'issue';
  next_cursor text := nullif(p_result->>'after', '');
  discovered boolean := coalesce((p_result->>'discovered')::boolean, false);
begin
  select * into job from private.instagram_analytics_sync
  where account_id = p_account and lease_id = p_lease and lease_until >= now() for update;
  if not found then return false; end if;

  insert into private.instagram_analytics_media (account_id, media_id, kind, published_at, permalink, likes, comments)
  select p_account, x.id, x.kind, x.published_at, x.permalink, x.likes, x.comments
  from jsonb_to_recordset(coalesce(p_result->'catalog', '[]'::jsonb))
    as x(id text, kind text, published_at timestamptz, permalink text, likes bigint, comments bigint)
  on conflict (account_id, media_id) do update
    set kind = excluded.kind, published_at = excluded.published_at, permalink = excluded.permalink,
        likes = coalesce(excluded.likes, instagram_analytics_media.likes),
        comments = coalesce(excluded.comments, instagram_analytics_media.comments);

  update private.instagram_analytics_media m
  set views = coalesce(x.views, m.views),
      measured_at = case when x.views is not null then now() else m.measured_at end,
      due_at = now() + case
        when x.views is null then interval '6 hours'
        when m.kind = 'story' then interval '4 hours'
        when m.published_at > now() - interval '7 days' then interval '6 hours'
        else interval '7 days'
      end
  from jsonb_to_recordset(coalesce(p_result->'measurements', '[]'::jsonb)) as x(id text, views bigint)
  where m.account_id = p_account and m.media_id = x.id;

  update private.instagram_analytics_sync s
  set lease_id = null, lease_until = null, issue = problem,
      followers = coalesce((p_result->>'followers')::bigint, s.followers),
      following = coalesce((p_result->>'following')::bigint, s.following),
      last_measured_at = case when exists (
        select 1 from jsonb_array_elements(coalesce(p_result->'measurements', '[]'::jsonb)) m
        where m->>'views' is not null
      ) then now() else s.last_measured_at end,
      last_catalog_at = case when discovered and job.discovery_edge = 'media' and next_cursor is null
        then now() else s.last_catalog_at end,
      discovery_edge = case when discovered and next_cursor is null
        then case when job.discovery_edge = 'media' then 'stories' else 'media' end
        else job.discovery_edge end,
      cursor_after = case when discovered then next_cursor
        when p_result->>'restart' = 'true' then null else job.cursor_after end,
      discover_at = case when discovered and job.discovery_edge = 'stories' and next_cursor is null
        then now() + interval '3 hours' else job.discover_at end,
      due_at = now() + case
        when problem in ('permission', 'reconnect') then interval '6 hours'
        when problem = 'temporary' then interval '15 minutes'
        when job.discover_at <= now() or jsonb_array_length(coalesce(p_result->'measurements', '[]'::jsonb)) > 0
          then interval '100 seconds'
        else interval '10 minutes'
      end
  where s.account_id = p_account;
  return true;
end;
$$;

create function public.get_instagram_top_posts(p_workspace uuid, p_account uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today timestamp;
  zone text;
  result jsonb;
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'workspace_access' using errcode = '42501';
  end if;
  select timezone into zone from public.workspaces where id = p_workspace;
  today := date_trunc('day', now() at time zone zone);

  with connected as (
    select a.id, a.username, s.issue, s.last_catalog_at
    from public.instagram_accounts a
    left join private.instagram_analytics_sync s on s.account_id = a.id
    where a.workspace_id = p_workspace and a.connection_status = 'connected'
  ), period_reels as (
    select m.account_id, a.username, m.media_id, m.published_at, m.permalink,
           m.views, m.likes, m.comments, m.likes + m.comments as interactions
    from private.instagram_analytics_media m
    join connected a on a.id = m.account_id
    where m.kind = 'reel'
      and m.published_at >= (today - interval '29 days') at time zone zone
      and m.published_at < (today + interval '1 day') at time zone zone
  ), filtered as (
    select * from period_reels where p_account is null or account_id = p_account
  ), ranking as (
    select f.*, row_number() over (
      order by views desc, interactions desc nulls last, published_at desc, account_id, media_id
    ) as position
    from filtered f where views is not null
    order by position limit 10
  ), totals as (
    select count(*) as reels, count(views) as measured, sum(views) as views,
      sum(likes) as likes, sum(comments) as comments, count(likes) as likes_measured,
      count(comments) as comments_measured
    from filtered
  ), leader as (
    select account_id, username, sum(interactions) as interactions, count(*) as measured,
      sum(likes) as likes, sum(comments) as comments
    from period_reels where interactions is not null
    group by account_id, username
    order by interactions desc, measured desc, username, account_id
    limit 1
  )
  select jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(to_jsonb(c) order by c.username,c.id) from connected c), '[]'::jsonb),
    'totals', (select to_jsonb(t) from totals t),
    'ranking', coalesce((select jsonb_agg(to_jsonb(r) order by r.position) from ranking r), '[]'::jsonb),
    'leader', (select to_jsonb(l) from leader l)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_instagram_top_posts(uuid, uuid) from public, anon;
grant execute on function public.get_instagram_top_posts(uuid, uuid) to authenticated;

commit;
