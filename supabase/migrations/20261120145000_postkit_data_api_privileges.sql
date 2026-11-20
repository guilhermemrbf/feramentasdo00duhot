-- New Supabase projects no longer grant Data API access to new tables by default.
-- Workspace RLS policies still apply to every authenticated client operation.
grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select on public.instagram_accounts to authenticated;
grant select, insert, update, delete on public.media_assets, public.caption_sets,
  public.hashtag_groups, public.publishing_schedules, public.posts to authenticated;
grant select on public.publish_attempts, public.publish_logs, public.post_metrics_snapshots to authenticated;
grant select, update on public.notifications to authenticated;

grant select on public.workspaces, public.workspace_members to service_role;
grant select, insert, update, delete on public.instagram_accounts, public.instagram_tokens to service_role;
grant select on public.media_assets to service_role;
