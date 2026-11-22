begin;

alter table private.platform_trial_invites
  alter column expires_at set default (now() + interval '15 minutes');

commit;
