-- Enable Cron and pg_net in Supabase first. Create these Vault secrets in the
-- Dashboard before running this file (do not paste secret values into the repo):
-- issb_project_url: https://YOUR_PROJECT.supabase.co
-- issb_scheduler_key: the project's DEFAULT new-format sb_secret_... API key
-- This matches auth: 'secret' in the reminder function, not a legacy JWT key.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'issb_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'issb_scheduler_key') then
    raise exception 'Create the ISSB project URL and scheduler key in Vault first.';
  end if;
end;
$$;

-- Safe to rerun: replace this named job instead of creating duplicate workers.
select cron.unschedule(jobid) from cron.job where jobname = 'cadetprep-issb-reminders';
select cron.schedule('cadetprep-issb-reminders', '* * * * *', $$
  select net.http_post(
    url := (select rtrim(decrypted_secret, '/') from vault.decrypted_secrets where name = 'issb_project_url') || '/functions/v1/issb-reminders',
    headers := jsonb_build_object('Content-Type','application/json','apikey',
      (select decrypted_secret from vault.decrypted_secrets where name = 'issb_scheduler_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
