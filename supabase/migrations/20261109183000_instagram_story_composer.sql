-- Keep earlier reminders readable by the old and new composer.
alter table public.instagram_story_reminders
  alter column link_url drop not null,
  alter column link_title drop not null,
  add column audience text not null default 'story'
    check (audience in ('story', 'close_friends')),
  add column stickers jsonb
    check (stickers is null or (
      jsonb_typeof(stickers) = 'object'
      and stickers - array['link','mention','hashtag','text'] = '{}'::jsonb
      and octet_length(stickers::text) <= 16000
    ));
