import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPortalSession } from '../../portal-session.js';
import { copy } from '../../portal-i18n.js';
function setup() {
  const fixture = { profile: { name: 'A' }, credits: { available: 1 }, purchases: [], upcoming: [], history: [] };
  let session = { expires_at: 1234 }, sessionError = null, userError = null, rpcError = null, response = fixture, status = 200;
  let calls = [], callback, unsubscribed = false, logoutError = null;
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: sessionError }),
      getUser: async () => ({ data: { user: userError ? null : { id: 'server-verified' } }, error: userError }),
      signOut: async (options) => { calls.push(options); session = null; return { error: logoutError }; },
      onAuthStateChange: (fn) => { callback = fn; return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } }; },
    },
    rpc: (name, body) => { calls.push({ name, body }); return { abortSignal: async () => ({ data: response, error: rpcError, status }) }; },
  };
  return { client, service: createPortalSession(client), calls, fixture,
    set: (values) => { if ('session' in values) session = values.session;
      sessionError = values.sessionError || null; userError = values.userError || null;
      rpcError = values.rpcError || null; status = values.status || 200;
      if ('response' in values) response = values.response; logoutError = values.logoutError || null; },
    fire: (event) => callback(event), unsubscribed: () => unsubscribed };
}
test('missing session denies before a private data request', async () => {
  const s = setup(); s.set({ session: null }); await assert.rejects(s.service.snapshot(), { code: 'SIGNED_OUT' }); assert.equal(s.calls.length, 0);
});
test('snapshot relies on SDK restoration/refresh and never transmits student/email arguments', async () => {
  const s = setup(); const value = await s.service.snapshot({ student_id: 'B', email: 'B' });
  assert.deepEqual(value, { data: s.fixture, expiresAt: 1234 });
  assert.deepEqual(s.calls, [{ name: 'portal_my_data', body: {} }]);
});
test('expired refresh and forged identity do not reach RPC', async () => {
  for (const values of [{ sessionError: { code: 'refresh_token_not_found' } }, { userError: { status: 401 } }]) {
    const s = setup(); s.set(values); await assert.rejects(s.service.snapshot(), { code: 'SIGNED_OUT' }); assert.equal(s.calls.length, 0);
  }
});
test('network errors do not become an authorized or demo snapshot', async () => {
  const s = setup(); s.set({ userError: { status: 503 } }); await assert.rejects(s.service.snapshot(), { code: 'UNAVAILABLE' });
});
test('server denial is generic, regardless of underlying private message', async () => {
  const s = setup(); s.set({ rpcError: { code: '42501', message: 'private fixture information' }, status: 403 });
  await assert.rejects(s.service.snapshot(), (e) => e.code === 'DENIED' && !e.message.includes('private'));
});
test('invalid or failed RPC response cannot display stale data', async () => {
  for (const values of [{ response: {} }, { rpcError: { code: 'P0001' }, status: 500 }]) {
    const s = setup(); s.set(values); await assert.rejects(s.service.snapshot(), { code: 'UNAVAILABLE' });
  }
});
test('logout uses SDK local scope and prevents subsequent private read', async () => {
  const s = setup(); assert.deepEqual(await s.service.logout(), { remoteConfirmed: true });
  assert.deepEqual(s.calls, [{ scope: 'local' }]); await assert.rejects(s.service.snapshot(), { code: 'SIGNED_OUT' });
});
test('SDK local logout is honored even when remote revocation reports an error', async () => {
  const s = setup(); s.set({ logoutError: { status: 503 } }); assert.deepEqual(await s.service.logout(), { remoteConfirmed: false });
  await assert.rejects(s.service.snapshot(), { code: 'SIGNED_OUT' });
});
test('cross-tab signout and token refresh notifications are exposed without tokens', () => {
  const s = setup(), events = []; const stop = s.service.subscribe((event) => events.push(event));
  s.fire('SIGNED_OUT'); s.fire('TOKEN_REFRESHED'); stop();
  assert.deepEqual(events, ['SIGNED_OUT', 'TOKEN_REFRESHED']); assert.equal(s.unsubscribed(), true);
});
test('portal copy covers identical ES/EN/PL keys and markup labels', () => {
  const keys = Object.keys(copy.es).sort();
  for (const lang of ['en', 'pl']) assert.deepEqual(Object.keys(copy[lang]).sort(), keys);
  for (const file of ['acceso.html', 'mis-clases.html', 'auth-callback.html']) {
    const html = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
    for (const [, key] of html.matchAll(/data-portal-i18n="([^"]+)"/g)) assert.ok(copy.es[key] && copy.en[key] && copy.pl[key], key);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /Content-Security-Policy/);
  }
});
