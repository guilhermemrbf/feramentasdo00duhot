-- Isolate requests from the publish handler, even if an older build serves the URL.
select cron.alter_job(
  (select jobid from cron.job where jobname = '00duhot-instagram-analytics'),
  command := $cron$
    select net.http_post(
      url := 'https://feramentasdo00duhot.lovable.app/api/instagram/worker?job=analytics',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Analytics ' || s.decrypted_secret),
      timeout_milliseconds := 25000
    )
    from vault.decrypted_secrets s
    join private.instagram_worker_auth a on a.vault_secret_id = s.id
    where a.singleton;
  $cron$
);
