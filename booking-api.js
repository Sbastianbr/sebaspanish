import { BOOKING_API_CONFIG } from './booking-config.js?v=20260928-development1';
import { loadAvailability, indexAvailability, prepareBooking, offerFor } from './reservas-data.js?v=20260928-development1';

export class BookingApiError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function createBookingApi(config = BOOKING_API_CONFIG, fetchImpl = (...args) => fetch(...args)) {
  const isLive = config.mode === 'supabase';
  const configuredMode = ['demo', 'supabase'].includes(config.mode);
  let attempt = null;
  async function request(endpoint, body) {
    let url;
    try {
      url = new URL(config.functionsUrl);
      if (url.username || url.password || url.search || url.hash ||
          (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new Error();
    } catch { throw new BookingApiError('CONFIGURATION_ERROR'); }
    let response;
    try {
      response = await fetchImpl(`${url.href.replace(/\/$/, '')}/${endpoint}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body), credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(15000),
      });
    } catch { throw new BookingApiError('NETWORK_ERROR'); }
    let data;
    try { data = await response.json(); } catch { throw new BookingApiError('INVALID_RESPONSE'); }
    if (!response.ok) throw new BookingApiError(data?.error?.code || 'SERVER_ERROR');
    return data;
  }
  return {
    isLive,
    initialSource: isLive ? 'live' : 'unconnected',
    async getAvailableSlots(state) {
      if (!configuredMode) throw new BookingApiError('CONFIGURATION_ERROR');
      if (!isLive) return loadAvailability(state);
      const result = await request('booking-availability', {type:state.type, plan:state.plan});
      if (result?.source !== 'live' || !Array.isArray(result.slots)) throw new BookingApiError('INVALID_RESPONSE');
      // Server owns duration/prices; the UI checks its displayed catalogue still agrees.
      return indexAvailability(result, state.timezone, offerFor(state));
    },
    async createBooking(state, availability, language) {
      if (!configuredMode) throw new BookingApiError('CONFIGURATION_ERROR');
      if (!isLive) return prepareBooking(state, availability);
      const slot = availability.slots.get(state.date)?.find(item => item.startAt === state.startAt);
      if (!slot) throw new BookingApiError('SLOT_UNAVAILABLE');
      const selection = {
        type:state.type, plan:state.plan, slotId:slot.id, timezone:state.timezone,
        student:Object.fromEntries(Object.entries(state.student).map(([key,value]) => [key,value.trim()])),
      };
      const fingerprint = JSON.stringify(selection);
      // Keep the SAME request on a retry, including after a timeout or language switch.
      // Kept only in memory. No student details or booking token in localStorage/URLs.
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = {fingerprint, payload:{...selection, language, requestId:crypto.randomUUID()}};
      }
      const result = await request('booking-create', attempt.payload);
      if (!result?.id || result.status !== 'confirmed' || result.slotId !== slot.id ||
          result.startAt !== slot.startAt || result.endAt !== slot.endAt ||
          result.type !== state.type || result.plan !== state.plan || result.timezone !== state.timezone ||
          result.currency !== 'PLN' || !Number.isFinite(result.price) || !Number.isInteger(result.sessions) ||
          !Number.isInteger(result.durationMinutes)) throw new BookingApiError('INVALID_RESPONSE');
      return result;
    },
  };
}
