begin;

create function public.save_platform_instagram_grant(
  p_workspace_id uuid, p_user_id uuid, p_accounts jsonb, p_scopes text[],
  p_token_ciphertext text, p_expires_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Use the same lock as save_instagram_workspace_app so a central grant
  -- cannot overwrite a connection while the workspace switches to its own app.
  perform 1 from public.workspaces where id = p_workspace_id for update;
  if not found or exists (
    select 1 from public.instagram_workspace_apps a
    where a.workspace_id = p_workspace_id and a.app_id is not null
  ) then return false; end if;

  perform public.save_instagram_unified_accounts(
    p_workspace_id, p_user_id, p_accounts, p_scopes, p_token_ciphertext, p_expires_at
  );
  return true;
end;
$$;

revoke all on function public.save_platform_instagram_grant(uuid,uuid,jsonb,text[],text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_platform_instagram_grant(uuid,uuid,jsonb,text[],text,timestamptz)
  to service_role;

commit;
