import { applyCors, enforceRateLimit } from './_utils.js';

export default function handler(req, res) {
  if (!applyCors(req, res, 'GET, OPTIONS')) return;

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res)) return;

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
