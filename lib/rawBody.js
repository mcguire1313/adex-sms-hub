// Read the raw POST body off a Next.js API request. Required for signature
// verification (Twilio status callbacks, OpenPhone webhooks) where we need the
// exact bytes the provider signed, not a JSON.parse round-trip.
export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
