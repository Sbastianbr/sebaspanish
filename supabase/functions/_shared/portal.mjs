import { BookingError, readJSON } from './booking.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeAccessRequest(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
      Object.keys(body).length !== 1 || typeof body.email !== 'string' ||
      body.email.length > 254 || /[\u0000-\u001f\u007f]/u.test(body.email)) {
    throw new BookingError('INVALID_REQUEST');
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BookingError('INVALID_REQUEST');
  return email;
}

export function createEmailHash(secret) {
  let key;
  return async (email) => {
    if (!secret || secret.length < 32) throw new Error('PORTAL_NOT_CONFIGURED');
    key ??= crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', await key, new TextEncoder().encode(email));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  };
}

// Supabase's admin /invite creates a truly passwordless identity and emails the
// first access link. /admin/users would generate an internal random password.
export function createPortalAuth({ url, serverKey, publicKey, redirectUrl, fetchImpl = fetch }) {
  async function call(path, body, key, method = 'POST') {
    if (!url || !key) throw new Error('PORTAL_NOT_CONFIGURED');
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
    });
    // Never propagate an Auth response body: it may contain identifiers or tokens.
    if (!response.ok) throw new Error('PORTAL_AUTH_FAILED');
    return response;
  }
  return {
    async inviteIdentity(email) {
      if (redirectUrl !== 'http://127.0.0.1:4181/sebaspanishv2/auth-callback.html') throw new Error('PORTAL_NOT_CONFIGURED');
      const response = await call(`invite?redirect_to=${encodeURIComponent(redirectUrl)}`, { email }, serverKey);
      const user = await response.json();
      if (!UUID.test(user?.id) || user.email?.trim().toLowerCase() !== email) throw new Error('PORTAL_AUTH_FAILED');
      return user.id;
    },
    async sendMagicLink(email, id) {
      // Deliberately Development-only for Phase 2B. No client-controlled redirect.
      if (redirectUrl !== 'http://127.0.0.1:4181/sebaspanishv2/auth-callback.html') {
        throw new Error('PORTAL_NOT_CONFIGURED');
      }
      if (!UUID.test(id)) throw new Error('PORTAL_AUTH_FAILED');
      const response = await call(`admin/users/${id}`, undefined, serverKey, 'GET');
      const user = await response.json();
      if (user.id !== id || user.email?.trim().toLowerCase() !== email || user.is_anonymous) {
        throw new Error('PORTAL_AUTH_FAILED');
      }
      const redirect = encodeURIComponent(redirectUrl);
      if (!user.email_confirmed_at) {
        // /otp sends unconfirmed users through signup, which is deliberately disabled.
        // /invite reuses the checked unconfirmed identity and emails a passwordless link.
        // Never auto-confirm an email just to work around Auth's signup restriction.
        await call(`invite?redirect_to=${redirect}`, { email }, serverKey);
      } else {
        await call(`otp?redirect_to=${redirect}`, { email, create_user: false }, publicKey);
      }
    },
  };
}

export function createAccessProcessor({ rpc, auth, hashEmail, deliveryAllowlist = [] }) {
  const allowed = new Set(deliveryAllowlist.map((email) => email.trim().toLowerCase()));
  return async (email) => {
    if (!await rpc('portal_request_claim', { p_email_hash: await hashEmail(email) })) return;
    const rows = await rpc('portal_access_eligibility', { p_email: email });
    if (!Array.isArray(rows) || rows.length !== 1) return;
    // An explicit Development email allowlist prevents accidental delivery during tests.
    if (!allowed.has(email)) return;
    const student = rows[0];
    if (!UUID.test(student.student_id) || student.normalized_email !== email) throw new Error('PORTAL_GATE_FAILED');
    const link = (id = null) => rpc('portal_auth_link', { p_student_id: student.student_id, p_auth_user_id: id });
    let id = await link();
    if (!id) {
      try {
        id = await auth.inviteIdentity(email);
      } catch {
        // Invitation may have succeeded despite a lost response, or a concurrent request.
        // Re-read under SQL checks; do not overwrite identity or create a second account.
        id = await link();
        if (!id) throw new Error('PORTAL_AUTH_FAILED');
      }
      await link(id);
      return; // The invitation already delivered the first link; never send twice.
    }
    if (!UUID.test(id)) throw new Error('PORTAL_AUTH_FAILED');
    await auth.sendMagicLink(email, id);
  };
}

export function createPortalHandler({ origins, processAccess, defer, reportFailure = () => {} }) {
  // Reuse the booking origin configuration, narrowed to the approved local Auth callback.
  const allowed = new Set(origins.filter((origin) => origin === 'http://127.0.0.1:4181'));
  return async (request) => {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type' };
    const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!origin || !allowed.has(origin)) return response({ error: { code: 'ORIGIN_NOT_ALLOWED' } }, 403);
    headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
    let email;
    try {
      email = normalizeAccessRequest(await readJSON(request));
    } catch (error) {
      return response({ error: { code: 'INVALID_REQUEST' } }, error instanceof BookingError ? error.status : 400);
    }
    // Respond independently of eligibility, database latency, throttling and email delivery.
    // EdgeRuntime.waitUntil keeps the work alive; failures only log a constant code.
    try {
      defer(Promise.resolve().then(() => processAccess(email)).catch(() => reportFailure('PORTAL_ACCESS_FAILED')));
    } catch {
      reportFailure('PORTAL_ACCESS_FAILED');
    }
    return response({ ok: true });
  };
}
