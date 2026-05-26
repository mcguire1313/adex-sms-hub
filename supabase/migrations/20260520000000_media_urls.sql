-- Add media attachment storage to sms_messages.
-- Each entry: { url, contentType, provider, sid? }
--   url        : provider-native URL (Twilio auth'd, or OpenPhone public CDN)
--   contentType: e.g. "image/jpeg", "video/mp4", "application/pdf"
--   provider   : "twilio" | "openphone"
--   sid        : optional provider-side identifier
--
-- The UI uses /api/media/twilio?... to proxy Twilio URLs (which require basic
-- auth) and renders OpenPhone URLs directly.

alter table public.sms_messages
  add column if not exists media_urls jsonb not null default '[]'::jsonb;
