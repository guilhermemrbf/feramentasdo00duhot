-- Device identities remain authenticated Supabase users; anonymous visitors never
-- receive a shared workspace ID, service key, or permission to another workspace.
create table public.postkit_device_invites (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 minutes',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.postkit_device_invites enable row level security;
revoke all on public.postkit_device_invites from anon, authenticated;

create function public.ensure_postkit_workspace()
returns setof public.workspaces language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Device authorization required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 6110601));
  if not exists(select 1 from public.workspaces w where public.is_workspace_member(w.id)) then
    insert into public.workspaces(name, owner_id, timezone) values('Minha operação', auth.uid(), 'America/Sao_Paulo');
  end if;
  return query select w.* from public.workspaces w where public.is_workspace_member(w.id) order by w.created_at;
end;
$$;

create function public.create_postkit_device_invite(p_workspace_id uuid, p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_workspace_role(p_workspace_id, array['owner','admin']::public.workspace_role[]) then
    raise exception 'Workspace access denied'; end if;
  insert into public.postkit_device_invites(token_hash,workspace_id,created_by)
    values(p_token_hash,p_workspace_id,auth.uid());
end;
$$;

create function public.accept_postkit_device_invite(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.postkit_device_invites;
begin
  if auth.uid() is null then raise exception 'Device authorization required'; end if;
  select * into invitation from public.postkit_device_invites where token_hash=p_token_hash for update;
  if not found or invitation.expires_at <= now() or invitation.used_at is not null or invitation.revoked_at is not null then
    raise exception 'Invite invalid, expired or already used'; end if;
  if not exists(select 1 from public.workspaces w where w.id=invitation.workspace_id and w.owner_id=invitation.created_by)
    and not exists(select 1 from public.workspace_members m where m.workspace_id=invitation.workspace_id
      and m.user_id=invitation.created_by and m.role in ('owner','admin')) then
    raise exception 'Invite author no longer authorized'; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(invitation.workspace_id,auth.uid(),'editor')
    on conflict(workspace_id,user_id) do nothing;
  update public.postkit_device_invites set used_by=auth.uid(),used_at=now() where token_hash=p_token_hash;
  return invitation.workspace_id;
end;
$$;

create function public.revoke_postkit_device_invite(p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.postkit_device_invites set revoked_at=now() where token_hash=p_token_hash
    and public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]);
end;
$$;

revoke all on function public.ensure_postkit_workspace() from public, anon;
revoke all on function public.create_postkit_device_invite(uuid,text) from public, anon;
revoke all on function public.accept_postkit_device_invite(text) from public, anon;
revoke all on function public.revoke_postkit_device_invite(text) from public, anon;
grant execute on function public.ensure_postkit_workspace() to authenticated;
grant execute on function public.create_postkit_device_invite(uuid,text) to authenticated;
grant execute on function public.accept_postkit_device_invite(text) to authenticated;
grant execute on function public.revoke_postkit_device_invite(text) to authenticated;
