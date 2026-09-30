// Public Development configuration: never put service_role in browser code.
import { createPortalSession } from './portal-session.js';
export const PORTAL_URL = 'https://vvvugnkvtkcfuwxroies.supabase.co';
const PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnVnbmt2dGtjZnV3eHJvaWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDE4NjAsImV4cCI6MjEwNjE3Nzg2MH0.xagihcAW_ZyvUSLlc9rGC2NAClc0oOtu5RmSTl9axSY';
export function portalClient({ callback = false } = {}) {
  if (location.origin !== 'http://127.0.0.1:4181' || !globalThis.supabase) {
    throw new Error('PORTAL_NOT_CONFIGURED');
  }
  return globalThis.supabase.createClient(PORTAL_URL, PUBLIC_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: callback,
      flowType: 'implicit', storageKey: 'sebaspanish-development-auth', debug: false },
    global: { fetch: (input, init = {}) => fetch(input, {
      ...init, cache: 'no-store', signal: init.signal || AbortSignal.timeout(15000),
    }) },
  });
}
export function portalService(options) { return createPortalSession(portalClient(options)); }
