import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const script = read('script.js');
const booking = read('reservas.js');
const html = read('index.html') + read('reservar.html');
const translations = runInNewContext('(' + script.split('const translations = ')[1].split(';\n  // El español')[0] + ')');
const copy = runInNewContext('(' + booking.split('const copy = ')[1].split(';\n\n  const root')[0] + ')');
const keys = [...html.matchAll(/data-i18n(?:-aria|-alt|-own)?="([^"]+)"/g)].map((m) => m[1]);

test('Every home and shared HTML key has a complete EN/PL translation', () => {
  for (const lang of ['en', 'pl']) for (const key of keys) {
    assert.equal(typeof translations[lang][key], 'string', `${lang}: ${key}`);
    assert.ok(translations[lang][key].trim(), `${lang}: empty ${key}`);
  }
});
test('English and Polish dictionaries cover the same keys', () => {
  assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.pl).sort());
});
test('All eight FAQ answers and dynamic biography/modal labels are translated', () => {
  for (const lang of ['en', 'pl']) {
    for (let n = 1; n <= 8; n++) for (const part of ['q', 'a']) assert.ok(translations[lang][`faq_${part}${n}`]);
    for (const key of ['bio_open', 'bio_close', 'review_modal_title']) assert.ok(translations[lang][key]);
    assert.ok(translations[lang].review_modal_title.includes('{name}'));
  }
});
test('Booking labels and literal dynamic keys exist in all three languages', () => {
  const referenced = [...html.matchAll(/data-booking-text="([^"]+)"/g), ...booking.matchAll(/\bt\("([^"+]+)"\)/g)].map(m => m[1]);
  for (const key of referenced) assert.ok(copy[key], key);
  for (const [key, values] of Object.entries(copy)) {
    assert.equal(values.length, 3, key);
    assert.ok(values.every(value => typeof value === 'string' && value.trim()), key);
  }
});
test('The requested document titles have a single shared owner', () => {
  assert.equal(translations.en.page_title, 'SebaSpanish | Online Spanish lessons');
  assert.equal(translations.pl.page_title, 'SebaSpanish | Hiszpański online');
  assert.ok(script.includes('page_title: "SebaSpanish | Clases de español online"'));
  assert.ok(!booking.includes('document.title ='));
});
