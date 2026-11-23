create function public.get_postkit_dashboard_performance(
  p_workspace uuid, p_start timestamptz, p_end timestamptz
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not coalesce(public.is_workspace_member(p_workspace), false) then
    raise exception 'workspace_access' using errcode = '42501';
  end if;

  with accounts as (
    select id, username, connection_status
    from public.instagram_accounts where workspace_id = p_workspace
  ), published as (
    select p.instagram_account_id, p.content_type from public.posts p
    where p.workspace_id = p_workspace and p.status = 'published'
      and p.published_at is not null
      and (p_start is null or p.published_at >= p_start)
      and (p_end is null or p.published_at < p_end)
  ), ranked as (
    select a.id, a.username, count(*) as reels, count(m.views) as measured, sum(m.views) as views
    from accounts a
    join private.instagram_analytics_media m on m.account_id = a.id
    where a.connection_status = 'connected' and m.kind = 'reel'
      and (p_start is null or m.published_at >= p_start)
      and (p_end is null or m.published_at < p_end)
    group by a.id, a.username
  )
  select jsonb_build_object(
    'published', (select count(*) from published where content_type = 'reel'),
    'active', (select count(*) from accounts a where a.connection_status = 'connected'
      and exists (select 1 from published p where p.instagram_account_id = a.id)),
    'connected', (select count(*) from accounts where connection_status = 'connected'),
    'views', (select sum(views) from ranked),
    'measured', (select coalesce(sum(measured), 0) from ranked),
    'reels', (select coalesce(sum(reels), 0) from ranked),
    'accountNames', (select coalesce(jsonb_object_agg(id, username), '{}'::jsonb) from accounts),
    'ranking', (select coalesce(jsonb_agg(
      jsonb_build_object('id', id, 'username', username, 'views', views)
      order by views desc, username, id
    ), '[]'::jsonb) from ranked where views is not null)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_postkit_dashboard_performance(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.get_postkit_dashboard_performance(uuid, timestamptz, timestamptz)
  to authenticated;
