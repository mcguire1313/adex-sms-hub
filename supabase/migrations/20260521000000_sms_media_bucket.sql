-- Public Supabase Storage bucket for outbound MMS attachments.
--
-- Why public: Twilio's MMS service needs to GET the media URL anonymously
-- when it sends the message. Signed URLs would also work but they make
-- expiry/refresh awkward, and the URLs are unguessable (random UUIDs in
-- the path) so the practical exposure is small.
--
-- 5 MB cap matches Twilio's published MMS size limit. Mime allowlist keeps
-- the bucket from being abused as generic file hosting.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sms-media',
  'sms-media',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- With public=true, the bucket is readable without policies. Uploads still
-- require authentication via the service key (which our /api/upload/sign
-- endpoint mints signed URLs with), so no anon write policy is needed.
