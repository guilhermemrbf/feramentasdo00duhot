-- Instagram app registration and OAuth both lock the workspace row with FOR UPDATE.
-- PostgreSQL requires UPDATE on at least one column for that lock. Grant only the timestamp.
grant update (updated_at) on public.workspaces to service_role;
