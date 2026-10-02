import { createRpc } from '../_shared/booking.mjs';
import { createAccessProcessor, createEmailHash, createPortalAuth, createPortalHandler } from '../_shared/portal.mjs';

const env = (name: string) => Deno.env.get(name) || '';
const processAccess = createAccessProcessor({
  rpc: createRpc({ url: env('SUPABASE_URL'), key: env('SUPABASE_SERVICE_ROLE_KEY') }),
  auth: createPortalAuth({ url: env('SUPABASE_URL'), serverKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    publicKey: env('SUPABASE_ANON_KEY'), redirectUrl: env('PORTAL_AUTH_REDIRECT_URL') }),
  hashEmail: createEmailHash(env('PORTAL_RATE_LIMIT_SECRET')),
  deliveryAllowlist: env('PORTAL_ACCESS_ALLOWED_EMAILS').split(',').filter(Boolean),
});

Deno.serve(createPortalHandler({
  origins: env('BOOKING_ALLOWED_ORIGINS').split(',').map((value) => value.trim()),
  processAccess,
  defer: (work: Promise<void>) => EdgeRuntime.waitUntil(work),
  // Do not log request bodies, addresses, identifiers, Auth responses or tokens.
  reportFailure: () => console.error('PORTAL_ACCESS_FAILED'),
}));
