// Client-side upload helper: signs an upload URL through our /api/upload/sign
// route, then PUTs the bytes directly to Supabase Storage. Returns the public
// URL that should be passed to /api/sms/send as mediaUrls[i].

export async function uploadMedia(file) {
  if (!file) throw new Error('No file');
  if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds 5 MB limit');

  // 1. Get a signed upload URL.
  const signRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type }),
  });
  const signJson = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signJson.error || `Sign failed (${signRes.status})`);
  }
  const { uploadUrl, publicUrl } = signJson;

  // 2. Upload directly to Supabase Storage.
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => '');
    throw new Error(`Upload failed (${putRes.status}): ${txt.slice(0, 200)}`);
  }

  return { url: publicUrl, contentType: file.type };
}
