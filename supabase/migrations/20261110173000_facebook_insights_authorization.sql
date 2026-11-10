-- Facebook's user token is used only for reading insights. Publishing still uses the Page token.
alter table public.instagram_tokens
  add column analytics_access_token_ciphertext text,
  add column analytics_token_expires_at timestamptz;
