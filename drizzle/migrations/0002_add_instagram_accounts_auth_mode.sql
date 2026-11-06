ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS auth_mode text NOT NULL DEFAULT 'instagram_login';

ALTER TABLE public.instagram_accounts
  DROP CONSTRAINT IF EXISTS instagram_accounts_auth_mode_check;

ALTER TABLE public.instagram_accounts
  ADD CONSTRAINT instagram_accounts_auth_mode_check
  CHECK (auth_mode IN ('instagram_login', 'facebook_login'));

COMMENT ON COLUMN public.instagram_accounts.auth_mode IS 'OAuth flow used to connect: instagram_login (Instagram Login API) or facebook_login (Facebook Login for professional accounts linked to a Facebook Page).';