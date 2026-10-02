import { createHandler, createRpc } from "../_shared/booking.mjs";

// Credentials remain in the Edge environment, never in a browser response or log.
Deno.serve(createHandler({
  action: "create",
  origins: (Deno.env.get("BOOKING_ALLOWED_ORIGINS") || "").split(",").map(value => value.trim()).filter(Boolean),
  rpc: createRpc({
    url: Deno.env.get("SUPABASE_URL"),
    key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  }),
}));
