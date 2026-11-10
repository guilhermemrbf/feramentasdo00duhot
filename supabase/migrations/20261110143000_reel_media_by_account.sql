begin;

alter table public.media_assets
  add column reel_account_id uuid,
  add constraint reel_media_account_same_workspace foreign key (reel_account_id, workspace_id)
    references public.instagram_accounts(id, workspace_id);

create index media_assets_reel_account_idx
  on public.media_assets(workspace_id, reel_account_id, import_batch_id);

create index posts_reel_media_account_idx on public.posts(media_asset_id, instagram_account_id)
  where content_type = 'reel' and status in ('scheduled', 'processing', 'needs_review', 'published');

-- Preserve past and pending publications. An older video can be assigned only
-- if the assignment agrees with its confirmed and potentially live destinations.
create function public.guard_reel_media_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.reel_account_id is not null and old.reel_account_id is distinct from new.reel_account_id then
    raise exception 'reel_media_already_assigned' using errcode = '23514';
  end if;
  if new.reel_account_id is distinct from old.reel_account_id and exists (
    select 1 from public.posts p
    where p.media_asset_id = old.id and p.content_type = 'reel'
      and p.status in ('scheduled', 'processing', 'needs_review', 'published')
      and p.instagram_account_id <> new.reel_account_id
  ) then
    raise exception 'reel_media_used_by_another_account' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_reel_media_assignment
before update of reel_account_id on public.media_assets
for each row execute function public.guard_reel_media_assignment();

create function public.guard_reel_post_media_account()
returns trigger language plpgsql set search_path = '' as $$
declare
  owner_account uuid;
begin
  if new.content_type <> 'reel' then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.content_type, old.media_asset_id, old.instagram_account_id, old.workspace_id)
      is not distinct from
       (new.content_type, new.media_asset_id, new.instagram_account_id, new.workspace_id) then
      return new;
    end if;
  end if;

  select m.reel_account_id into owner_account
  from public.media_assets m
  where m.id = new.media_asset_id and m.workspace_id = new.workspace_id
  for share;

  if owner_account is distinct from new.instagram_account_id then
    raise exception 'reel_media_account_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_reel_post_media_account
before insert or update of content_type, media_asset_id, instagram_account_id, workspace_id on public.posts
for each row execute function public.guard_reel_post_media_account();

create function private.guard_reel_loop_media_account()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (
    select count(*) from public.media_assets m
    where m.workspace_id = new.workspace_id and m.reel_account_id = new.account_id
      and m.id = any(new.asset_ids)
  ) <> cardinality(new.asset_ids) then
    raise exception 'reel_media_account_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_reel_loop_media_account
before insert or update of workspace_id, account_id, asset_ids on private.instagram_reel_loops
for each row execute function private.guard_reel_loop_media_account();

-- An existing loop can keep its progress. It pauses if the next video
-- cannot be published under that loop's account.
create or replace function public.enqueue_due_instagram_reel_loops()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  loop_row private.instagram_reel_loops%rowtype;
  previous_status public.post_status;
  asset_id uuid;
  asset_account_id uuid;
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

    select item.id, item.asset_index::integer, m.reel_account_id
      into asset_id, asset_position, asset_account_id
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

    if asset_account_id is distinct from loop_row.account_id then
      update private.instagram_reel_loops
      set state = 'paused', pause_reason = 'media_account' where id = loop_row.id;
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

commit;
