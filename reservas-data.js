// Contrato de reservas: importes en PLN, instantes ISO en UTC y zonas IANA.
// No contiene credenciales, llamadas externas ni disponibilidad de producción.
export const BOOKING_CONFIG = Object.freeze({
  teacherTimezone: "Europe/Warsaw",
  bookingHorizonDays: 60,
  minimumNoticeHours: 12,
});
export const OFFERS = Object.freeze({
  prueba: { price: 0, durationMinutes: 30, sessions: 1 },
  1: { price: 65, durationMinutes: 60, sessions: 1 },
  4: { price: 230, durationMinutes: 60, sessions: 4 },
  8: { price: 440, durationMinutes: 60, sessions: 8 },
  dele: null, // Catálogo DELE pendiente: nunca reutilizar los precios de 1 a 1.
});
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DAY = 86400000;
export const addDays = (date, days) => new Date(Date.parse(date + "T12:00:00Z") + days * DAY).toISOString().slice(0, 10);
const formatters = new Map();
export function dateInZone(instant, timezone) {
  if (!formatters.has(timezone)) {
    formatters.set(timezone, new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }));
  }
  const p = Object.fromEntries(formatters.get(timezone).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function timeInZone(instant, timezone, locale = "es") {
  // El offset corresponde a la sesión, no a hoy. Distingue horas repetidas en DST.
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).format(new Date(instant));
}
export function parseSelection(search) {
  const params = new URLSearchParams(search);
  const type = ["prueba", "1a1", "dele"].includes(params.get("tipo")) ? params.get("tipo") : "1a1";
  const plan = type === "1a1" && ["1", "4", "8"].includes(params.get("plan")) ? Number(params.get("plan")) : null;
  const deleLevel = type === "dele" && LEVELS.includes(params.get("nivel")) ? params.get("nivel") : null;
  return { type, plan, deleLevel };
}
export const offerFor = (state) => OFFERS[state.type === "1a1" ? state.plan : state.type];

// Fuentes locales para el modo demo explícito. booking-api.js gestiona Supabase.
// "unconnected" mantiene la agenda vacía hasta activar los ejemplos.
const providers = {
  unconnected: async () => ({ source: "unconnected", slots: [] }),
  demo: async ({ now, offer }) => {
    // Fixtures explícitos: nueve ejemplos UTC, solo tras activar la demostración.
    const base = new Date(now).toISOString().slice(0, 10);
    const slots = [2, 3, 7].flatMap((offset) => [9, 13, 17].map((hour) => {
      const startAt = `${addDays(base, offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;
      return {
        id: `demo-${startAt}-${offer.durationMinutes}`,
        startAt,
        endAt: new Date(Date.parse(startAt) + offer.durationMinutes * 60000).toISOString(),
      };
    }));
    return { source: "demo", slots };
  },
};

export function indexAvailability(result, timezone, offer, now = Date.now()) {
  const today = dateInZone(now, timezone);
  const lastDay = addDays(today, BOOKING_CONFIG.bookingHorizonDays - 1);
  const slots = new Map();
  const seen = new Set();
  if (!Array.isArray(result?.slots)) throw new TypeError("Availability slots must be an array");
  for (const slot of result.slots) {
    if (!slot || typeof slot !== "object") continue;
    const start = Date.parse(slot.startAt), end = Date.parse(slot.endAt);
    if (!offer || !slot.id || seen.has(start) || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (!/Z$/.test(slot.startAt) || !/Z$/.test(slot.endAt)) continue;
    if (start < now + BOOKING_CONFIG.minimumNoticeHours * 3600000 || end - start !== offer.durationMinutes * 60000) continue;
    const date = dateInZone(start, timezone);
    if (date < today || date > lastDay) continue;
    seen.add(start);
    if (!slots.has(date)) slots.set(date, []);
    slots.get(date).push({ ...slot, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), available: true });
  }
  for (const items of slots.values()) items.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return { source: result.source, today, lastDay, slots };
}
export async function loadAvailability(state, now = Date.now()) {
  const provider = providers[state.availabilitySource];
  if (!provider) throw new Error("Unknown availability provider");
  const offer = offerFor(state);
  const result = offer ? await provider({ type: state.type, plan: state.plan, offer, now }) : { source: "unconnected", slots: [] };
  return indexAvailability(result, state.timezone, offer, now);
}
export function createBookingDraft(state, availability, now = new Date()) {
  const offer = offerFor(state);
  const slot = availability.slots.get(state.date)?.find((item) => item.startAt === state.startAt);
  if (!offer || !slot?.available ||
      Date.parse(slot.endAt) - Date.parse(slot.startAt) !== offer.durationMinutes * 60000 ||
      dateInZone(slot.startAt, state.timezone) !== state.date ||
      Date.parse(slot.startAt) < now.getTime() + BOOKING_CONFIG.minimumNoticeHours * 3600000) {
    throw new Error("A valid service and available slot are required");
  }
  return {
    version: 2, status: "draft_local", availabilitySource: availability.source,
    createdAt: now.toISOString(), type: state.type, plan: state.plan, deleLevel: state.deleLevel,
    durationMinutes: offer.durationMinutes, price: offer.price, currency: "PLN",
    sessions: offer.sessions, sessionNumber: 1, slotId: slot.id,
    startAt: slot.startAt, endAt: slot.endAt,
    timezone: state.timezone, teacherTimezone: BOOKING_CONFIG.teacherTimezone,
    student: Object.fromEntries(Object.entries(state.student).map(([key, value]) => [key, value.trim()])),
  };
}
export async function prepareBooking(state, availability) {
  // Solo demo: el adaptador usa el endpoint real cuando mode es "supabase".
  return createBookingDraft(state, availability);
}
