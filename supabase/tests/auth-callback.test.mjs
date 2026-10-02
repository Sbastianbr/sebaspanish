import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalSession } from '../../portal-session.js';
function setup({ session = true, initError = null, userError = null, access = true } = {}) {
  const calls = [];
  const client = {
    auth: {
      initialize: async () => ({ error: initError }),
      getSession: async () => ({ data: { session: session ? { expires_at: 123 } : null }, error: null }),
      getUser: async () => { calls.push('verified-user'); return { data: { user: userError ? null : { id: 'verified' } }, error: userError }; },
    },
    rpc: (name, body) => { calls.push({ name, body }); return { abortSignal: async () => ({ data: access, error: null }) }; },
  };
  return { service: createPortalSession(client), calls };
}
test('callback without a session cannot access a private RPC', async () => {
  const { service, calls } = setup({ session: false });
  await assert.rejects(service.completeAccess(), { code: 'SIGNED_OUT' }); assert.equal(calls.length, 0);
});
test('SDK callback rejects invalid/expired links before reading a stored identity', async () => {
  const { service, calls } = setup({ initError: { code: 'otp_expired' } });
  await assert.rejects(service.completeAccess(), { code: 'INVALID_LINK' }); assert.equal(calls.length, 0);
});
test('callback verifies Auth then invokes identity-free current-access gate', async () => {
  const { service, calls } = setup(); await service.completeAccess();
  assert.deepEqual(calls, ['verified-user', { name: 'portal_current_access', body: {} }]);
});
test('forged/revoked identity and ineligible verified identity cannot enter portal', async () => {
  await assert.rejects(setup({ userError: { status: 401 } }).service.completeAccess(), { code: 'SIGNED_OUT' });
  await assert.rejects(setup({ access: false }).service.completeAccess(), { code: 'DENIED' });
});
test('callback network errors have a controlled generic state', async () => {
  await assert.rejects(setup({ userError: { status: 503 } }).service.completeAccess(), { code: 'UNAVAILABLE' });
});
