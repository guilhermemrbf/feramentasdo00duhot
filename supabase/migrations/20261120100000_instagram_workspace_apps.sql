begin;

create table public.instagram_workspace_apps (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  revision uuid not null default gen_random_uuid(),
  app_id text unique,
  login_config_id text,
  secret_ciphertext text,
  constraint instagram_workspace_app_credentials check (
    (app_id is null and login_config_id is null and secret_ciphertext is null)
    or (
      app_id is not null and app_id ~ '^[0-9]{1,32}$'
      and login_config_id is not null and login_config_id ~ '^[0-9]{1,32}$'
      and secret_ciphertext is not null and secret_ciphertext like 'v1.%'
    )
  )
);

-- Keep the existing platform integration only for operations with a saved OAuth grant.
insert into public.instagram_workspace_apps (workspace_id)
select distinct a.workspace_id
from public.instagram_accounts a join public.instagram_tokens t on t.account_id = a.id;

alter table public.instagram_workspace_apps enable row level security;
revoke all on public.instagram_workspace_apps from public, anon, authenticated;
grant select, insert, update on public.instagram_workspace_apps to service_role;

-- An account must come from a server-side OAuth callback, never a client write.
revoke insert, update, delete on public.instagram_accounts from public, anon, authenticated;

create function public.save_instagram_workspace_app(
  p_workspace_id uuid, p_user_id uuid, p_app_id text, p_login_config_id text,
  p_secret_ciphertext text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare old_app public.instagram_workspace_apps;
begin
  if p_app_id is null or p_login_config_id is null or p_secret_ciphertext is null then
    raise exception 'Instagram app credentials required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace_id and (
      w.owner_id = p_user_id or exists (
        select 1 from public.workspace_members m where m.workspace_id = w.id
          and m.user_id = p_user_id and m.role in ('owner','admin')
      )
    )
  ) then raise exception 'Workspace administrator required' using errcode = '42501'; end if;

  perform 1 from public.workspaces where id = p_workspace_id for update;
  select * into old_app from public.instagram_workspace_apps where workspace_id = p_workspace_id;
  if found and (
    old_app.app_id is null or (
      old_app.app_id <> p_app_id and exists (
        select 1 from public.instagram_accounts a
        join public.instagram_tokens t on t.account_id = a.id
        where a.workspace_id = p_workspace_id
      )
    )
  ) then return false; end if;

  insert into public.instagram_workspace_apps (workspace_id, app_id, login_config_id, secret_ciphertext)
  values (p_workspace_id, p_app_id, p_login_config_id, p_secret_ciphertext)
  on conflict (workspace_id) do update set
    revision = gen_random_uuid(), app_id = excluded.app_id, login_config_id = excluded.login_config_id,
    secret_ciphertext = excluded.secret_ciphertext;
  return true;
end;
$$;

create function public.save_workspace_instagram_grant(
  p_workspace_id uuid, p_user_id uuid, p_revision uuid, p_accounts jsonb, p_scopes text[],
  p_token_ciphertext text, p_expires_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.workspaces where id = p_workspace_id for update;
  if not exists (
    select 1 from public.instagram_workspace_apps a where a.workspace_id = p_workspace_id
      and a.revision = p_revision and (a.app_id is null or not exists (
        select 1 from jsonb_to_recordset(p_accounts) as profile(login_config_id text)
        where profile.login_config_id is distinct from a.login_config_id
      ))
  ) then return false; end if;

  perform public.save_instagram_unified_accounts(
    p_workspace_id, p_user_id, p_accounts, p_scopes, p_token_ciphertext, p_expires_at
  );
  return true;
end;
$$;

revoke all on function public.save_instagram_workspace_app(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.save_instagram_workspace_app(uuid,uuid,text,text,text) to service_role;
revoke all on function public.save_workspace_instagram_grant(uuid,uuid,uuid,jsonb,text[],text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_workspace_instagram_grant(uuid,uuid,uuid,jsonb,text[],text,timestamptz)
  to service_role;

commit;
