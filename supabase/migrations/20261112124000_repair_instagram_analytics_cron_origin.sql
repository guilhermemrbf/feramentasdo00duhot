begin;

-- The MauseHot rename changed the published host. Keep the analytics job's
-- schedule, Vault-based authorization and publishing isolation intact.
select cron.alter_job(
  j.jobid,
  command := replace(
    j.command,
    'https://feramentasdo00duhot.lovable.app/api/instagram/worker?job=analytics',
    'https://mausehot.lovable.app/api/instagram/worker?job=analytics'
  )
)
from cron.job as j
where j.jobname = '00duhot-instagram-analytics'
  and strpos(j.command, 'https://feramentasdo00duhot.lovable.app/api/instagram/worker?job=analytics') > 0;

commit;
