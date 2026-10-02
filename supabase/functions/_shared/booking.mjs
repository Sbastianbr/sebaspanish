// No SDK dependency: the Edge Function calls two fixed RPCs through PostgREST.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class BookingError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const fail = (code) => {
  throw new BookingError(code);
};
function exactObject(value, keys, code = "INVALID_REQUEST") {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail(code);
}
export function validateSelection(body) {
  if (body.type === "prueba" && body.plan === null) return;
  if (body.type === "1a1" && [1, 4, 8].includes(body.plan)) return;
  fail("INVALID_PLAN");
}
export function validateAvailability(body) {
  exactObject(body, ["type", "plan"]);
  validateSelection(body);
  return body;
}
export function validateBooking(body) {
  exactObject(body, [
    "type",
    "plan",
    "slotId",
    "requestId",
    "timezone",
    "language",
    "student",
  ]);
  validateSelection(body);
  if (
    typeof body.slotId !== "string" ||
    !UUID.test(body.slotId) ||
    typeof body.requestId !== "string" ||
    !REQUEST_ID.test(body.requestId) ||
    !["es", "en", "pl"].includes(body.language) ||
    typeof body.timezone !== "string" ||
    body.timezone.length > 100
  )
    fail("INVALID_REQUEST");
  try {
    new Intl.DateTimeFormat("en", { timeZone: body.timezone });
  } catch {
    fail("INVALID_REQUEST");
  }
  const fields = {
    name: 100,
    email: 254,
    phone: 40,
    language: 5,
    country: 100,
    spanishLevel: 2,
    message: 1500,
  };
  exactObject(body.student, Object.keys(fields), "INVALID_STUDENT");
  const student = {};
  for (const [key, max] of Object.entries(fields)) {
    const value = body.student[key];
    if (
      typeof value !== "string" ||
      value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
    )
      fail("INVALID_STUDENT");
    student[key] = value.trim();
  }
  student.email = student.email.toLowerCase();
  if (
    !student.name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email) ||
    !["es", "en", "pl", "other"].includes(student.language) ||
    !["", "A1", "A2", "B1", "B2", "C1", "C2"].includes(student.spanishLevel)
  )
    fail("INVALID_STUDENT");
  return { ...body, student };
}

const sqlErrors = {
  INVALID_REQUEST: 400,
  INVALID_PLAN: 400,
  INVALID_STUDENT: 400,
  SLOT_UNAVAILABLE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RATE_LIMITED: 429,
};
export function createRpc({ url, key, fetchImpl = fetch }) {
  return async (name, params) => {
    if (!url || !key) throw new BookingError("SERVER_NOT_CONFIGURED", 503);
    let response;
    try {
      response = await fetchImpl(
        `${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(12000),
        },
      );
    } catch {
      throw new BookingError("SERVER_ERROR", 503);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new BookingError("SERVER_ERROR", 503);
    }
    if (!response.ok) {
      if (data?.code === "P0001" && Object.hasOwn(sqlErrors, data.message))
        throw new BookingError(data.message, sqlErrors[data.message]);
      if (data?.code === "23P01")
        throw new BookingError("SLOT_UNAVAILABLE", 409);
      // Never forward SQL details, queries, credentials or personal information.
      throw new BookingError("SERVER_ERROR", 503);
    }
    return data;
  };
}

// Enforce the byte limit on the stream, not just on a forgeable Content-Length.
export async function readJSON(request) {
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    throw new BookingError("INVALID_REQUEST", 415);
  const reader = request.body?.getReader();
  if (!reader) fail("INVALID_REQUEST");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new BookingError("PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      fail("INVALID_REQUEST");
    }
  } finally {
    reader.releaseLock();
  }
}

export function createHandler({ action, rpc, origins }) {
  const allowed = new Set(origins);
  return async (request) => {
    const origin = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "X-Content-Type-Options": "nosniff",
    };
    const respond = (body, status) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!allowed.size)
      return respond({ error: { code: "SERVER_NOT_CONFIGURED" } }, 503);
    // CORS restricts browser origins, not bots. Do not treat Origin as authentication.
    if (!origin || !allowed.has(origin))
      return respond({ error: { code: "ORIGIN_NOT_ALLOWED" } }, 403);
    headers["Access-Control-Allow-Origin"] = origin;
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return respond({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
    try {
      const body = await readJSON(request);
      if (action === "availability") {
        validateAvailability(body);
        return respond(
          await rpc("booking_available_slots", {
            p_type: body.type,
            p_plan: body.plan,
          }),
          200,
        );
      }
      const payload = validateBooking(body);
      return respond(await rpc("booking_create", { p_payload: payload }), 200);
    } catch (error) {
      if (error instanceof BookingError)
        return respond({ error: { code: error.code } }, error.status);
      return respond({ error: { code: "SERVER_ERROR" } }, 503);
    }
  };
}
