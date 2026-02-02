import crypto from 'crypto';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);
const rateLimitMap = new Map();
const authCache = new Map();
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function timingSafeEquals(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

function getCachedAuth(token) {
  const cached = authCache.get(token);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    authCache.delete(token);
    return null;
  }
  return cached.payload;
}

function setCachedAuth(token, payload) {
  let ttl = AUTH_CACHE_TTL_MS;
  const decoded = decodeJwtPayload(token);
  if (decoded?.exp) {
    const expMs = decoded.exp * 1000;
    const remaining = expMs - Date.now();
    if (remaining > 0) ttl = Math.min(ttl, remaining);
  }
  authCache.set(token, { payload, expiresAt: Date.now() + ttl });
}

function getAllowedOrigins() {
  const derivedOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const fallback =
    process.env.NODE_ENV === 'production' ? derivedOrigin : 'http://localhost:5173';
  const raw = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || fallback;
  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function applyCors(req, res, methods = 'POST, OPTIONS') {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;

  if (origin) {
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (allowedOrigins.length > 0) {
      res.status(403).json({ error: 'Origin not allowed' });
      return false;
    }
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

export function enforceRateLimit(req, res) {
  const ipHeader = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader || '')
    .split(',')[0]
    .trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  const record = rateLimitMap.get(ip);
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please wait a minute before trying again.' });
    return false;
  }

  record.count += 1;
  return true;
}

async function verifyWithSupabase(token) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500 };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey
    }
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const payload = await response.json();
  return { ok: true, payload };
}

export async function requireSupabaseAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization token.' });
    return { ok: false };
  }

  const token = authHeader.slice(7);
  const cached = getCachedAuth(token);
  if (cached) return { ok: true, payload: cached };

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret) {
    const parts = token.split('.');
    if (parts.length === 3) {
      const [headerB64, payloadB64, signature] = parts;
      const data = `${headerB64}.${payloadB64}`;
      const expected = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());

      if (timingSafeEquals(signature, expected)) {
        try {
          const payload = JSON.parse(base64UrlDecode(payloadB64));
          if (payload.exp && Date.now() / 1000 >= payload.exp) {
            res.status(401).json({ error: 'Authorization token expired.' });
            return { ok: false };
          }
          setCachedAuth(token, payload);
          return { ok: true, payload };
        } catch {
          res.status(401).json({ error: 'Invalid authorization token.' });
          return { ok: false };
        }
      }
    }
  }

  try {
    const result = await verifyWithSupabase(token);
    if (result.ok) {
      setCachedAuth(token, result.payload);
      return { ok: true, payload: result.payload };
    }
    const status = result.status === 401 || result.status === 403 ? 401 : 500;
    res.status(status).json({ error: 'Invalid authorization token.' });
    return { ok: false };
  } catch {
    res.status(500).json({ error: 'Server configuration error.' });
    return { ok: false };
  }
}
