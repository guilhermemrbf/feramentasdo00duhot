-- Recurring Reels reuse the existing posts queue and its publishing checkpoints.
create schema if not exists private;

create table private.instagram_reel_loops (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null,
  name text not null check (char_length(name) between 1 and 100),
  asset_ids uuid[] not null check (cardinality(asset_ids) between 1 and 100),
  caption text not null check (char_length(caption) <= 2200),
  interval_minutes integer not null check (interval_minutes between 120 and 43200),
  next_at timestamptz not null,
  cursor_index integer not null default 0,
  state text not null default 'active' check (state in ('active', 'paused', 'finished')),
  pause_reason text,
  last_post_id uuid references public.posts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (account_id, workspace_id)
    references public.instagram_accounts(id, workspace_id) on delete cascade
);

revoke all on table private.instagram_reel_loops from public, anon, authenticated, service_role;
create unique index reel_loops_one_active_per_account
  on private.instagram_reel_loops(account_id) where state = 'active';
create index reel_loops_due_idx on private.instagram_reel_loops(next_at) where state = 'active';
create index reel_loops_workspace_idx on private.instagram_reel_loops(workspace_id, created_at desc);

create function public.list_instagram_reel_loops(p_workspace_id uuid)
returns table (
  id uuid, name text, account_id uuid, username text, state text, pause_reason text,
  interval_minutes integer, next_at timestamptz, asset_index integer, total integer
)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.name, l.account_id, a.username, l.state, l.pause_reason,
         l.interval_minutes, l.next_at, l.cursor_index, cardinality(l.asset_ids)
  from private.instagram_reel_loops l
  join public.instagram_accounts a on a.id = l.account_id
  where l.workspace_id = p_workspace_id and public.is_workspace_member(p_workspace_id)
  order by l.created_at desc, l.id
  limit 100;
$$;
revoke all on function public.list_instagram_reel_loops(uuid) from public, anon;
grant execute on function public.list_instagram_reel_loops(uuid) to authenticated;

create function public.create_instagram_reel_loops(
  p_workspace_id uuid, p_name text, p_account_ids uuid[], p_asset_ids uuid[],
  p_caption text, p_interval_minutes integer, p_start_at timestamptz
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  inserted integer;
begin
  if not public.has_workspace_role(p_workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[]) then
    raise exception 'workspace_access' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_account_ids), 0) not between 1 and 20
     or coalesce(cardinality(p_asset_ids), 0) not between 1 and 100
     or coalesce(char_length(trim(p_name)), 0) not between 1 and 100
     or p_caption is null or char_length(p_caption) > 2200
     or p_interval_minutes is null or p_interval_minutes not between 120 and 43200
     or p_start_at is null or not isfinite(p_start_at) or p_start_at <= now() then
    raise exception 'loop_invalid';
  end if;
  if (
    select count(*) from public.instagram_accounts a
    where a.workspace_id = p_workspace_id and a.id = any(p_account_ids)
      and a.connection_status = 'connected'
  ) <> cardinality(p_account_ids) then
    raise exception 'loop_accounts_unavailable';
  end if;
  if (
    select count(*) from public.media_assets m
    where m.workspace_id = p_workspace_id and m.id = any(p_asset_ids)
      and m.archived_at is null and m.status in ('uploaded', 'ready')
      and m.mime_type in ('video/mp4', 'video/quicktime')
  ) <> cardinality(p_asset_ids) then
    raise exception 'loop_media_unavailable';
  end if;
  insert into private.instagram_reel_loops
    (workspace_id, account_id, name, asset_ids, caption, interval_minutes, next_at, created_by)
  select p_workspace_id, a.id, trim(p_name), p_asset_ids, p_caption,
         p_interval_minutes, p_start_at, auth.uid()
  from unnest(p_account_ids) as a(id)
  order by a.id;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.create_instagram_reel_loops(uuid, text, uuid[], uuid[], text, integer, timestamptz) from public, anon;
grant execute on function public.create_instagram_reel_loops(uuid, text, uuid[], uuid[], text, integer, timestamptz) to authenticated;

create function public.set_instagram_reel_loop_paused(p_id uuid, p_paused boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  loop_row private.instagram_reel_loops%rowtype;
begin
  select l.* into loop_row
  from private.instagram_reel_loops l
  where l.id = p_id
    and public.has_workspace_role(l.workspace_id, array['owner', 'admin', 'editor']::public.workspace_role[])
  for update;
  if not found or p_paused is null or loop_row.state = 'finished' then return false; end if;
  if not p_paused and (
    not exists (select 1 from public.instagram_accounts a where a.id = loop_row.account_id and a.connection_status = 'connected')
    or exists (select 1 from public.posts p where p.id = loop_row.last_post_id and p.status = 'needs_review')
  ) then return false; end if;

  update private.instagram_reel_loops
  set state = case when p_paused then 'paused' else 'active' end,
      pause_reason = case when p_paused then 'manual' else null end,
      next_at = case when p_paused then next_at else greatest(next_at, now()) end,
      last_post_id = case when not p_paused and exists (
        select 1 from public.posts p where p.id = loop_row.last_post_id and p.status = 'failed'
      ) then null else last_post_id end
  where id = p_id;
  return true;
end;
$$;
revoke all on function public.set_instagram_reel_loop_paused(uuid, boolean) from public, anon;
grant execute on function public.set_instagram_reel_loop_paused(uuid, boolean) to authenticated;

create function public.enqueue_due_instagram_reel_loops()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  loop_row private.instagram_reel_loops%rowtype;
  previous_status public.post_status;
  asset_id uuid;
  asset_position integer;
  post_id uuid;
  queued integer := 0;
begin
  for loop_row in
    select l.* from private.instagram_reel_loops l
    where l.state = 'active' and l.next_at <= now()
    order by l.next_at, l.id limit 20 for update skip locked
  loop
    if not exists (select 1 from public.instagram_accounts a where a.id = loop_row.account_id and a.connection_status = 'connected') then
      update private.instagram_reel_loops set state = 'paused', pause_reason = 'account' where id = loop_row.id;
      continue;
    end if;
    select p.status into previous_status from public.posts p where p.id = loop_row.last_post_id;
    if previous_status in ('scheduled', 'processing') then
      update private.instagram_reel_loops set next_at = now() + interval '1 minute' where id = loop_row.id;
      continue;
    elsif previous_status in ('failed', 'needs_review') then
      update private.instagram_reel_loops set state = 'paused', pause_reason = 'post' where id = loop_row.id;
      continue;
    end if;

    select item.id, item.asset_index::integer into asset_id, asset_position
    from unnest(loop_row.asset_ids) with ordinality as item(id, asset_index)
    join public.media_assets m on m.id = item.id and m.workspace_id = loop_row.workspace_id
    where item.asset_index > loop_row.cursor_index
      and m.archived_at is null and m.status in ('uploaded', 'ready')
      and m.mime_type in ('video/mp4', 'video/quicktime')
      and not exists (
        select 1 from public.posts p
        where p.workspace_id = loop_row.workspace_id and p.instagram_account_id = loop_row.account_id
          and p.media_asset_id = item.id and p.status in ('scheduled', 'processing', 'published', 'needs_review')
      )
    order by item.asset_index limit 1;
    if not found then
      update private.instagram_reel_loops set state = 'finished' where id = loop_row.id;
      continue;
    end if;

    insert into public.posts
      (workspace_id, instagram_account_id, media_asset_id, content_type, caption, scheduled_at, timezone, status, created_by)
    select loop_row.workspace_id, loop_row.account_id, asset_id, 'reel', loop_row.caption,
           now(), w.timezone, 'scheduled', loop_row.created_by
    from public.workspaces w where w.id = loop_row.workspace_id
    returning id into post_id;
    update private.instagram_reel_loops
    set last_post_id = post_id, cursor_index = asset_position,
        next_at = now() + make_interval(mins => loop_row.interval_minutes)
    where id = loop_row.id;
    queued := queued + 1;
  end loop;
  return queued;
end;
$$;
revoke all on function public.enqueue_due_instagram_reel_loops() from public, anon, authenticated;
grant execute on function public.enqueue_due_instagram_reel_loops() to service_role;
