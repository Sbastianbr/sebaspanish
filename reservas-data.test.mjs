import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Vanilla browser module, without requiring package.json or npm dependencies.
const source = await readFile(new URL('./reservas-data.js', import.meta.url), 'utf8');
const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = Date.parse('2026-10-23T08:00:00Z');
const state = (plan = 4) => ({ type: '1a1', plan, deleLevel: null, timezone: 'Europe/Warsaw', availabilitySource: 'demo', student: { name: ' Test ', email: 'test@example.com', language: 'en' } });

test('URL selections preserve approved prices and separate DELE', () => {
  for (const [plan, price] of [[1, 65], [4, 230], [8, 440]]) {
    const selection = api.parseSelection(`?tipo=1a1&plan=${plan}`);
    assert.equal(selection.plan, plan);
    assert.equal(api.offerFor(selection).price, price);
  }
  assert.deepEqual(api.offerFor(api.parseSelection('?tipo=prueba&plan=8')), { price: 0, durationMinutes: 30, sessions: 1 });
  const dele = api.parseSelection('?tipo=dele&nivel=C1&plan=4');
  assert.equal(dele.deleLevel, 'C1');
  assert.equal(dele.plan, null);
  assert.equal(api.offerFor(dele), null);
  assert.deepEqual(api.parseSelection('?tipo=invalid&plan=999&nivel=Z'), { type: '1a1', plan: null, deleLevel: null });
});
test('normal source never fabricates availability', async () => {
  const result = await api.loadAvailability({ ...state(), availabilitySource: 'unconnected' }, now);
  assert.equal(result.source, 'unconnected');
  assert.equal(result.slots.size, 0);
  await assert.rejects(api.loadAvailability({ ...state(), availabilitySource: 'invalid' }, now));
});
test('demo is explicit and returns UTC sessions of the chosen duration', async () => {
  for (const selection of [state(), { ...state(), type: 'prueba', plan: null }]) {
    const result = await api.loadAvailability(selection, now);
    const slots = [...result.slots.values()].flat();
    assert.equal(slots.length, 9);
    assert.equal(result.source, 'demo');
    for (const slot of slots) assert.equal(Date.parse(slot.endAt) - Date.parse(slot.startAt), api.offerFor(selection).durationMinutes * 60000);
  }
});
test('timezone dates cross midnight and repeated DST hours keep distinct offsets', () => {
  const instant = '2026-10-25T00:30:00Z';
  assert.equal(api.dateInZone(instant, 'America/Los_Angeles'), '2026-10-24');
  assert.equal(api.dateInZone(instant, 'Asia/Tokyo'), '2026-10-25');
  const first = api.timeInZone(instant, 'Europe/Warsaw', 'en');
  const second = api.timeInZone('2026-10-25T01:30:00Z', 'Europe/Warsaw', 'en');
  assert.match(first, /02:30/); assert.match(second, /02:30/);
  assert.notEqual(first, second);
  assert.match(api.timeInZone('2026-03-29T00:30:00Z', 'Europe/Warsaw', 'en'), /01:30/);
  assert.match(api.timeInZone('2026-03-29T01:30:00Z', 'Europe/Warsaw', 'en'), /03:30/);
});
test('expired, malformed, duplicate and wrong-duration slots are excluded', () => {
  const slot = { id: 'valid', startAt: '2026-10-25T00:30:00Z', endAt: '2026-10-25T01:30:00Z' };
  const result = api.indexAvailability({ source: 'test', slots: [slot, { ...slot, id: 'duplicate' }, { ...slot, id: 'short', endAt: '2026-10-25T01:00:00Z' }, { id: 'invalid', startAt: 'bad', endAt: 'bad' }, { id: 'expired', startAt: '2026-10-23T09:00:00Z', endAt: '2026-10-23T10:00:00Z' }] }, 'Europe/Warsaw', api.OFFERS[4], now);
  assert.equal([...result.slots.values()].flat().length, 1);
});
test('draft keeps selected UTC slot and remains explicitly unconfirmed', async () => {
  const selection = state();
  const result = await api.loadAvailability(selection, now);
  const [date, slots] = [...result.slots.entries()][0];
  Object.assign(selection, { date, startAt: slots[0].startAt });
  const draft = api.createBookingDraft(selection, result, new Date(now));
  assert.equal(draft.status, 'draft_local');
  assert.equal(draft.price, 230); assert.equal(draft.sessions, 4);
  assert.equal(draft.student.name, 'Test'); assert.equal(draft.student.language, 'en');
  assert.equal(draft.startAt, slots[0].startAt);
  assert.equal(draft.endAt, slots[0].endAt);
  assert.equal(draft.availabilitySource, 'demo');
  assert.doesNotThrow(() => JSON.stringify(draft));
  assert.throws(() => api.createBookingDraft({ ...selection, startAt: '2000-01-01T00:00:00Z' }, result, new Date(now)));
});


test('all DELE levels stay isolated from one-to-one plans and availability', async () => {
  for (const level of api.LEVELS) {
    const selection = api.parseSelection('?tipo=dele&nivel=' + level + '&plan=8');
    assert.deepEqual(selection, { type: 'dele', plan: null, deleLevel: level });
    assert.equal(api.offerFor(selection), null);
    const availability = await api.loadAvailability({ ...state(), ...selection }, now);
    assert.equal(availability.slots.size, 0);
  }
  assert.equal(api.parseSelection('?tipo=prueba&nivel=B2&plan=4').deleLevel, null);
  assert.equal(api.parseSelection('?tipo=1a1&plan=8&nivel=B2').deleLevel, null);
});
test('availability rejects invalid payloads and tolerates invalid entries', () => {
  assert.throws(() => api.indexAvailability({ slots: null }, 'Europe/Warsaw', api.OFFERS[1], now), TypeError);
  const result = api.indexAvailability({ source: 'demo', slots: [null, false, 42, {}] }, 'Europe/Warsaw', api.OFFERS[1], now);
  assert.equal(result.slots.size, 0);
});
test('a timezone change preserves the UTC session across local date boundaries', async () => {
  const selection = state();
  const result = await api.loadAvailability(selection, now);
  const slot = [...result.slots.values()].flat().at(-1);
  const changed = { ...selection, timezone: 'Asia/Tokyo', startAt: slot.startAt, date: api.dateInZone(slot.startAt, 'Asia/Tokyo') };
  const regrouped = await api.loadAvailability(changed, now);
  const draft = api.createBookingDraft(changed, regrouped, new Date(now));
  assert.equal(draft.startAt, slot.startAt);
  assert.equal(draft.timezone, 'Asia/Tokyo');
  assert.notEqual(changed.date, api.dateInZone(slot.startAt, 'Europe/Warsaw'));
});
test('draft rejects stale duration, unavailable slots and incorrect local date', async () => {
  const selection = state();
  const result = await api.loadAvailability(selection, now);
  const [date, slots] = [...result.slots.entries()][0];
  Object.assign(selection, { date, startAt: slots[0].startAt });
  assert.throws(() => api.createBookingDraft({ ...selection, type: 'prueba', plan: null }, result, new Date(now)));
  assert.throws(() => api.createBookingDraft({ ...selection, timezone: 'Pacific/Pago_Pago' }, result, new Date(now)));
  slots[0].available = false;
  assert.throws(() => api.createBookingDraft(selection, result, new Date(now)));
});

test('approved 12-hour notice accepts the boundary and rejects earlier slots', () => {
  const slots = [12 * 3600000 - 1,12 * 3600000,18 * 3600000].map((offset,index)=>({
    id:String(index),startAt:new Date(now+offset).toISOString(),
    endAt:new Date(now+offset+3600000).toISOString(),
  }));
  const result = api.indexAvailability({source:'live',slots},'Europe/Warsaw',api.OFFERS[1],now);
  assert.deepEqual([...result.slots.values()].flat().map(slot=>slot.id),['1','2']);
});
