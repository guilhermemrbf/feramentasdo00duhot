begin;

create schema if not exists private;

create table private.instagram_analytics_sync (
  account_id uuid primary key references public.instagram_accounts(id) on delete cascade,
  due_at timestamptz not null default now(),
  discover_at timestamptz not null default now(),
  discovery_edge text not null default 'media' check (discovery_edge in ('media', 'stories')),
  cursor_after text,
  lease_id uuid,
  lease_until timestamptz,
  last_attempt_at timestamptz,
  last_catalog_at timestamptz,
  last_measured_at timestamptz,
  followers bigint,
  following bigint,
  issue text check (issue in ('permission', 'reconnect', 'temporary'))
);

create table private.instagram_analytics_media (
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  media_id text not null,
  kind text not null check (kind in ('reel', 'post', 'story')),
  published_at timestamptz not null,
  permalink text,
  views bigint check (views >= 0),
  measured_at timestamptz,
  due_at timestamptz not null default now(),
  primary key (account_id, media_id)
);

revoke all on table private.instagram_analytics_sync, private.instagram_analytics_media
  from public, anon, authenticated, service_role;
create index instagram_analytics_due_idx on private.instagram_analytics_media(account_id, due_at);
create index instagram_analytics_published_idx
  on private.instagram_analytics_media(account_id, kind, published_at desc);

create function public.claim_instagram_analytics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  job private.instagram_analytics_sync%rowtype;
  account public.instagram_accounts%rowtype;
begin
  insert into private.instagram_analytics_sync (account_id)
  select id from public.instagram_accounts where connection_status = 'connected'
  on conflict do nothing;

  select s.account_id into target
  from private.instagram_analytics_sync s join public.instagram_accounts a on a.id = s.account_id
  where a.connection_status = 'connected'
    and (s.lease_until is null or s.lease_until < now())
    and (s.due_at <= now() or a.last_verified_at > s.last_attempt_at)
  order by s.last_attempt_at nulls first, s.due_at, s.account_id
  limit 1 for update of s skip locked;
  if not found then return null; end if;

  update private.instagram_analytics_sync
  set lease_id = gen_random_uuid(), lease_until = now() + interval '2 minutes', last_attempt_at = now()
  where account_id = target returning * into job;
  select * into account from public.instagram_accounts where id = target;
  return jsonb_build_object(
    'account_id', target, 'lease_id', job.lease_id, 'instagram_user_id', account.instagram_user_id,
    'auth_mode', account.auth_mode, 'edge', case when job.discover_at <= now() then job.discovery_edge end,
    'after', job.cursor_after, 'media', coalesce((
      select jsonb_agg(item.media_id) from (
        select m.media_id from private.instagram_analytics_media m
        where m.account_id = target and m.due_at <= now()
          and (m.kind <> 'story' or m.published_at >= now() - interval '24 hours')
        order by case when m.kind = 'story' then 0 else 1 end, m.due_at, m.media_id limit 4
      ) item
    ), '[]'::jsonb)
  );
end;
$$;

create function public.finish_instagram_analytics(p_account uuid, p_lease uuid, p_result jsonb)
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

  insert into private.instagram_analytics_media (account_id, media_id, kind, published_at, permalink)
  select p_account, x.id, x.kind, x.published_at, x.permalink
  from jsonb_to_recordset(coalesce(p_result->'catalog', '[]'::jsonb))
    as x(id text, kind text, published_at timestamptz, permalink text)
  on conflict (account_id, media_id) do update
    set kind = excluded.kind, published_at = excluded.published_at, permalink = excluded.permalink;

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

create function public.get_instagram_analytics(
  p_workspace uuid, p_account uuid, p_start timestamptz, p_end timestamptz, p_page integer
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'workspace_access' using errcode = '42501';
  end if;

  with connected as (
    select a.id, a.username, a.auth_mode, s.followers, s.following, s.issue,
      s.last_catalog_at, s.last_measured_at
    from public.instagram_accounts a
    left join private.instagram_analytics_sync s on s.account_id = a.id
    where a.workspace_id = p_workspace and a.connection_status = 'connected'
  ), selected as (
    select * from connected where p_account is null or id = p_account
  ), period_media as (
    select m.*, a.username from private.instagram_analytics_media m
    join selected a on a.id = m.account_id
    where (p_start is null or m.published_at >= p_start)
      and (p_end is null or m.published_at < p_end)
  ), totals as (
    select kind, count(*) as publications, count(views) as measured, sum(views) as views
    from period_media group by kind
  ), lifetime_reels as (
    select m.account_id, count(*) as reels, count(m.views) as measured, sum(m.views) as reel_views
    from private.instagram_analytics_media m join selected a on a.id = m.account_id
    where m.kind = 'reel' group by m.account_id
  ), reel_page as (
    select account_id, username, media_id, published_at, permalink, views
    from period_media where kind = 'reel'
    order by published_at desc, media_id, account_id
    limit 25 offset greatest(coalesce(p_page, 0), 0)::bigint * 25
  ), statuses as (
    select p.status, count(*) as total from public.posts p join selected a on a.id = p.instagram_account_id
    where p.workspace_id = p_workspace
      and (p_start is null or coalesce(p.published_at, p.scheduled_at, p.created_at) >= p_start)
      and (p_end is null or coalesce(p.published_at, p.scheduled_at, p.created_at) < p_end)
    group by p.status
  )
  select jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'username', username,
      'auth_mode', auth_mode) order by username, id) from connected), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'reel_views', r.reel_views, 'reels', coalesce(r.reels, 0), 'measured', coalesce(r.measured, 0)
    ) order by a.username, a.id) from selected a left join lifetime_reels r on r.account_id = a.id), '[]'::jsonb),
    'totals', coalesce((select jsonb_agg(to_jsonb(t)) from totals t), '[]'::jsonb),
    'reels', coalesce((select jsonb_agg(to_jsonb(r) order by r.published_at desc, r.media_id, r.account_id)
      from reel_page r), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(to_jsonb(s)) from statuses s), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.claim_instagram_analytics() from public, anon, authenticated;
revoke all on function public.finish_instagram_analytics(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_instagram_analytics(uuid, uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.claim_instagram_analytics() to service_role;
grant execute on function public.finish_instagram_analytics(uuid, uuid, jsonb) to service_role;
grant execute on function public.get_instagram_analytics(uuid, uuid, timestamptz, timestamptz, integer) to authenticated;

-- A separate cron keeps analytics running even when the publishing queue is busy.
select cron.schedule('00duhot-instagram-analytics', '* * * * *', $cron$
  select net.http_post(
    url := 'https://feramentasdo00duhot.lovable.app/api/instagram/worker?job=analytics',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || s.decrypted_secret),
    timeout_milliseconds := 25000
  )
  from vault.decrypted_secrets s
  join private.instagram_worker_auth a on a.vault_secret_id = s.id
  where a.singleton;
$cron$);

commit;
