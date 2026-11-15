begin;

-- Preserve schedules, authorization and queue state while repairing the renamed host.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.enable_instagram_worker()'::regprocedure) into definition;
  if strpos(definition, 'https://feramentasdo00duhot.lovable.app/api/instagram/worker') > 0 then
    execute replace(definition,
      'https://feramentasdo00duhot.lovable.app/api/instagram/worker',
      'https://mausehot.lovable.app/api/instagram/worker');
  end if;
end;
$$;

select cron.alter_job(j.jobid, command := replace(j.command,
  'https://feramentasdo00duhot.lovable.app/api/instagram/worker',
  'https://mausehot.lovable.app/api/instagram/worker'))
from cron.job j
where j.jobname in ('00duhot-instagram-worker', '00duhot-instagram-analytics')
  and strpos(j.command, 'https://feramentasdo00duhot.lovable.app/api/instagram/worker') > 0;

commit;
