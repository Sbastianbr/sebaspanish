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
  let bookingAttempt = null;
  const bookingErrors = new Set(['STUDENT_NOT_FOUND', 'NO_AVAILABLE_CREDITS', 'SLOT_UNAVAILABLE',
    'BOOKING_TOO_SOON', 'IDEMPOTENCY_CONFLICT', 'INVALID_SLOT', 'INVALID_REQUEST', 'INVALID_PLAN', 'RATE_LIMITED']);
  async function privateCall(name, args = {}, booking = false) {
    const { data, error, status } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
    if (error && booking && bookingErrors.has(error.message)) throw new PortalError(error.message);
    if (error) throw new PortalError(status === 401 || error?.message === 'UNAUTHENTICATED' ? 'SIGNED_OUT' :
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
    async availableSlots() {
      await verifiedSession();
      const data = await privateCall('portal_booking_slots', {}, true);
      if (data?.source !== 'live' || !Array.isArray(data.slots) || data.slots.some((slot) =>
        !slot.id || !Number.isFinite(Date.parse(slot.startAt)) || !Number.isFinite(Date.parse(slot.endAt)))) {
        throw new PortalError('UNAVAILABLE');
      }
      return data.slots;
    },
    async bookClass(slotId, timezone) {
      const session = await verifiedSession();
      // Only the server uses identity. Locally scope retries so account changes cannot reuse attempts.
      const fingerprint = JSON.stringify([session.user?.id, slotId, timezone]);
      if (!bookingAttempt || bookingAttempt.fingerprint !== fingerprint) {
        bookingAttempt = { fingerprint, args: { p_slot_id: slotId,
          p_request_id: crypto.randomUUID(), p_timezone: timezone } };
      }
      const receipt = await privateCall('portal_book_class', bookingAttempt.args, true);
      if (!receipt?.id || receipt.slotId !== slotId || receipt.timezone !== timezone ||
          !['confirmed', 'cancelled'].includes(receipt.status) || !Number.isFinite(Date.parse(receipt.startAt))) {
        throw new PortalError('UNAVAILABLE');
      }
      bookingAttempt = null;
      return receipt;
    },
    async logout() {
      bookingAttempt = null;
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
