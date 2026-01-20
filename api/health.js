export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const anthropicKeyLength = hasAnthropicKey ? process.env.ANTHROPIC_API_KEY.length : 0;

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV || 'not set',
    hasAnthropicKey,
    anthropicKeyLength,
    // Do NOT log the key itself
  });
}
