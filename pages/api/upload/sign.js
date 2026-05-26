import { getServiceClient } from '../../../lib/supabase';
import { randomUUID } from 'crypto';

const BUCKET = 'sms-media';
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
]);
const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
};

// POST { contentType }
//   -> { uploadUrl, token, path, publicUrl }
// The browser uploads to `uploadUrl` (Supabase signed PUT), then we send the
// SMS with `publicUrl` so Twilio/OpenPhone can GET it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { contentType } = req.body || {};
  if (typeof contentType !== 'string' || !ALLOWED_MIME.has(contentType)) {
    return res.status(400).json({ error: 'Unsupported contentType' });
  }
  const ext = MIME_TO_EXT[contentType] || 'bin';
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd, for friendly bucket layout
  const path = `outbound/${today}/${randomUUID()}.${ext}`;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .storage.from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({
      uploadUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl: pub.publicUrl,
      contentType,
    });
  } catch (err) {
    console.error('upload sign error', err);
    return res.status(500).json({ error: err.message });
  }
}
