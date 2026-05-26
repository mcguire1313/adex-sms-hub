// TEMPORARY KILL SWITCH — installed to stop runaway ai-recruiter duplicates.
// Restore the previous file (from git history) once the recruiter is paused.
export default function handler(req, res) {
  return res.status(503).json({ error: 'Sending is temporarily disabled (kill switch active).' });
}
