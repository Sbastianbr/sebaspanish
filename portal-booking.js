// Presentation only: PostgreSQL owns eligibility, duration and automatic credit selection.
import { t, date, language } from './portal-i18n.js';
export function createPortalBooking({ service, timeZone, refresh, denied }) {
  const $ = (id) => document.getElementById('portal-book-' + id);
  let slots = [], selectedDay = '', selectedSlot = '', version = 0, busy = false;
  let credits = 0, message = '', error = false, uncertain = false;
  const dayKey = (value) => new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
  function option(value, label) {
    const item = document.createElement('option'); item.value = value; item.textContent = label; return item;
  }
  function notice(key, failed = false) { message = key; error = failed; render(credits); }
  function render(available = credits) {
    credits = available;
    $('start').disabled = busy || credits < 1;
    $('start').hidden = !$('form').hidden;
    $('status').textContent = message ? t(message) : credits < 1 ? t('bookNoCredits') : '';
    $('status').hidden = !$('status').textContent;
    $('status').dataset.error = String(error);
    $('zone').textContent = `${t('timezone')} ${timeZone}`;
    const days = [...new Map(slots.map((slot) => [dayKey(slot.startAt), slot.startAt]))];
    $('day').replaceChildren(option('', t('bookChoose')), ...days.map(([key, at]) => option(key, date(at, timeZone))));
    $('day').value = selectedDay;
    const times = slots.filter((slot) => dayKey(slot.startAt) === selectedDay);
    $('slot').replaceChildren(option('', t('bookChoose')), ...times.map((slot) => option(slot.id,
      new Intl.DateTimeFormat(language(), { timeZone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(new Date(slot.startAt)))));
    $('slot').value = selectedSlot;
    $('day').disabled = busy || uncertain;
    $('slot').disabled = busy || uncertain || !selectedDay;
    $('cancel').disabled = busy || uncertain;
    $('confirm').disabled = busy || !selectedSlot;
    $('confirm').textContent = t(busy ? 'bookSending' : uncertain ? 'bookRetry' : 'bookConfirm');
    const selected = slots.find((slot) => slot.id === selectedSlot);
    $('summary').textContent = selected ? `${date(selected.startAt, timeZone, true)} · ${timeZone} · ${t('bookCost')}` : '';
  }
  function clear() {
    ++version; slots = []; selectedDay = ''; selectedSlot = ''; busy = false;
    uncertain = false; message = ''; error = false; $('form').hidden = true;
    $('day').replaceChildren(); $('slot').replaceChildren(); $('summary').textContent = ''; $('status').textContent = '';
  }
  function authError(e) {
    if (['SIGNED_OUT', 'DENIED', 'STUDENT_NOT_FOUND'].includes(e.code)) { denied(); return true; }
    return false;
  }
  async function choose(keepMessage = false) {
    const current = ++version; busy = true;
    if (!keepMessage) message = 'bookLoading';
    render();
    try {
      const items = await service.availableSlots();
      if (current !== version) return;
      slots = items; selectedDay = ''; selectedSlot = ''; uncertain = false;
      $('form').hidden = slots.length === 0;
      if (!keepMessage || !slots.length) message = slots.length ? '' : 'bookEmpty';
      if (slots.length) { render(); $('day').disabled = false; $('day').focus(); }
    } catch (e) {
      if (current !== version || authError(e)) return;
      message = 'unavailable'; error = true;
    } finally { if (current === version) { busy = false; render(); } }
  }
  $('start').addEventListener('click', () => { error = false; choose(); });
  $('day').addEventListener('change', () => { selectedDay = $('day').value; selectedSlot = ''; render(); });
  $('slot').addEventListener('change', () => { selectedSlot = $('slot').value; render(); });
  $('cancel').addEventListener('click', () => { clear(); render(); $('start').focus(); });
  $('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !selectedSlot) return;
    const current = ++version; busy = true; notice('bookSending');
    try {
      const receipt = await service.bookClass(selectedSlot, timeZone);
      if (current !== version) return;
      await refresh();
      // refresh clears private state and reauthorizes; only announce on the still-visible portal.
      if (!document.getElementById('portal-content').hidden) {
        notice(receipt.status === 'cancelled' ? 'bookAlreadyCancelled' : 'bookSuccess');
        $('status').tabIndex = -1; $('status').focus();
      }
    } catch (e) {
      if (current !== version || authError(e)) return;
      if (['SLOT_UNAVAILABLE', 'INVALID_SLOT', 'BOOKING_TOO_SOON'].includes(e.code)) {
        busy = false; notice(e.code === 'BOOKING_TOO_SOON' ? 'bookTooSoon' : 'bookTaken', true);
        await choose(true);
      } else if (e.code === 'NO_AVAILABLE_CREDITS') {
        await refresh();
        if (!document.getElementById('portal-content').hidden) notice('bookNoEligibleCredit', true);
      } else if (['IDEMPOTENCY_CONFLICT', 'INVALID_REQUEST', 'INVALID_PLAN', 'RATE_LIMITED'].includes(e.code)) {
        busy = false; uncertain = false;
        notice(e.code === 'IDEMPOTENCY_CONFLICT' ? 'bookConflict' : e.code === 'RATE_LIMITED' ? 'bookLimit' : 'unavailable', true);
      } else {
        // A timeout may follow a committed transaction. Keep selection + request for a safe retry.
        busy = false; uncertain = true; notice('bookUncertain', true);
      }
    } finally { if (current === version) { busy = false; render(); } }
  });
  return { clear, render };
}
