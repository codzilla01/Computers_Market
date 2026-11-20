const crypto = require('crypto');

const SESSION_COOKIE = 'cm_admin_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update('computers-market-secret-key-2026-v2').digest('hex');

function signPayload(payloadObj) {
  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function createSessionToken(admin) {
  return signPayload({
    id: admin.id,
    username: admin.username,
    email: admin.email,
    name: admin.name,
    exp: Date.now() + SESSION_TTL_MS
  });
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function extractToken(req) {
  if (req.cookies && req.cookies[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function requireAdmin(req, res, next) {
  const token = extractToken(req);
  const session = verifyToken(token);
  if (!session) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى لوحة الإدارة.' });
  }
  req.admin = session;
  next();
}

module.exports = {
  SESSION_COOKIE,
  createSessionToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  extractToken,
  requireAdmin
};
