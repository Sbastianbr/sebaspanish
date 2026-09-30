// The official Supabase client owns tokens, persistence, refresh and cross-tab events.
// This module never stores tokens or accepts a client-selected student identity.
export class PortalError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function authFailure(error) {
  return error?.status === 401 || error?.status === 403 ||
    ['session_not_found', 'session_expired', 'refresh_token_not_found',
      'refresh_token_already_used', 'bad_jwt'].includes(error?.code);
}

export function createPortalSession(client) {
  async function verifiedSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw new PortalError(authFailure(error) ? 'SIGNED_OUT' : 'UNAVAILABLE');
    if (!data?.session) throw new PortalError('SIGNED_OUT');
    // Stored session presence is only a hint. Verify with Auth before any private read.
    const identity = await client.auth.getUser();
    if (identity.error) throw new PortalError(authFailure(identity.error) ? 'SIGNED_OUT' : 'UNAVAILABLE');
    if (!identity.data?.user) throw new PortalError('SIGNED_OUT');
    return data.session;
  }
  async function privateCall(name) {
    const { data, error, status } = await client.rpc(name, {}).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new PortalError(status === 401 ? 'SIGNED_OUT' :
      error.code === '42501' ? 'DENIED' : 'UNAVAILABLE');
    return data;
  }
  return {
    async completeAccess() {
      const initialized = await client.auth.initialize();
      if (initialized.error) throw new PortalError('INVALID_LINK');
      await verifiedSession();
      if (await privateCall('portal_current_access') !== true) throw new PortalError('DENIED');
    },
    async snapshot() {
      const session = await verifiedSession();
      const data = await privateCall('portal_my_data');
      if (!data?.profile || !data?.credits ||
          !['purchases', 'upcoming', 'history'].every((key) => Array.isArray(data[key]))) {
        throw new PortalError('UNAVAILABLE');
      }
      return { data, expiresAt: session.expires_at };
    },
    async logout() {
      // scope=local revokes this session's refresh token, leaving other devices alone.
      // SDK 2.117.2 clears its local session even when remote logout fails.
      const { error } = await client.auth.signOut({ scope: 'local' });
      const { data } = await client.auth.getSession();
      if (data?.session) throw new PortalError('UNAVAILABLE');
      return { remoteConfirmed: !error };
    },
    subscribe(callback) {
      const { data } = client.auth.onAuthStateChange((event) => callback(event));
      return () => data.subscription.unsubscribe();
    },
  };
}
