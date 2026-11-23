-- Provision per-project secrets inside Vault and schedule the conversion worker.
-- Existing Vercel overrides must match the Vault entries when used.
do $$
declare
  secret_name text;
begin
  foreach secret_name in array array['scalehot_pixel_worker','scalehot_pixel_encryption'] loop
    if not exists(select 1 from vault.decrypted_secrets where name=secret_name) then
      perform vault.create_secret(translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_'),secret_name);
    end if;
  end loop;
end;
$$;

create function public.scalehot_pixel_runtime_secret(p_purpose text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = case p_purpose when 'worker' then 'scalehot_pixel_worker'
    when 'encryption' then 'scalehot_pixel_encryption' end;
$$;
revoke all on function public.scalehot_pixel_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.scalehot_pixel_runtime_secret(text) to service_role;

select cron.schedule('mousehot-scalehot-meta-conversions', '* * * * *', $job$
  select net.http_post(
    url := 'https://mausehot.vercel.app/api/public/meta-process',
    headers := jsonb_build_object('Authorization','Bearer ' || decrypted_secret,'Content-Type','application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 30000
  ) from vault.decrypted_secrets
  where name='scalehot_pixel_worker'
    and exists(select 1 from public.scalehot_meta_sales where state='pending' and not refunded
      and attempts<6 and paid_at>=now()-interval '168 hours' and next_attempt_at<=now());
$job$);
