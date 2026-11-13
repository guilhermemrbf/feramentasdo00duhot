-- Create the lot and schedule the profiles with an unambiguous, owned source.
create function public.analyze_instagram_intelligence_batch(p_usernames text[])
returns table (id uuid, name text, queued integer, awaiting_source integer)
language plpgsql security definer set search_path = '' as $$
declare
  batch_id uuid;
  batch_name text := 'Análise · ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  total_queued integer;
begin
  batch_id := public.create_instagram_intelligence_batch(batch_name, p_usernames);
  insert into public.instagram_intelligence_jobs(batch_id, username, source, source_label, workspace_id)
  select batch_id, lower(a.username), 'connected_analytics', 'Analytics do Instagram conectado',
    (array_agg(a.workspace_id))[1]
  from public.instagram_accounts a
  join public.workspaces w on w.id = a.workspace_id
  where w.owner_id = auth.uid() and a.connection_status = 'connected'
    and lower(a.username) = any(p_usernames)
  group by lower(a.username)
  having count(*) = 1;
  get diagnostics total_queued = row_count;
  return query select batch_id, batch_name, total_queued, cardinality(p_usernames) - total_queued;
end;
$$;

revoke all on function public.analyze_instagram_intelligence_batch(text[]) from public, anon, authenticated;
grant execute on function public.analyze_instagram_intelligence_batch(text[]) to authenticated;
