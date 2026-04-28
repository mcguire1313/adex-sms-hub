-- Add auto-reply classification audit trail to sms_messages.
-- auto_reply: webhook classifier verdict (true = looks like an automated/no-reply system).
-- auto_reply_score: integer score from the classifier (helps tune thresholds).
-- auto_reply_reviewed: human has reviewed the verdict (lets us catch false positives).

alter table public.sms_messages
  add column if not exists auto_reply boolean not null default false,
  add column if not exists auto_reply_score integer,
  add column if not exists auto_reply_reviewed boolean not null default false;

create index if not exists sms_messages_auto_reply_idx
  on public.sms_messages (auto_reply)
  where auto_reply = true;
