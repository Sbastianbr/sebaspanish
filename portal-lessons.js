// Management UI only. Ownership, time thresholds and credits are decided in PostgreSQL.
import { t, date } from './portal-i18n.js';
import { renderSlotOptions } from './portal-slots.js';
export function createPortalLessons({ service, timeZone, refresh, denied }) {
  const $ = id => document.getElementById('portal-manage-' + id);
  let lesson = null, action = '', opener, slots = [], day = '', slot = '';
  let version = 0, busy = false, uncertain = false, acceptLoss = false, message = '', failed = false;
  function notice(key, error = false) { message = key; failed = error; render(); }
  function render() {
    $('status').hidden = !message; $('status').textContent = message ? t(message) : '';
    $('status').dataset.error = String(failed);
    document.querySelectorAll('[data-manage-action]').forEach(button => { button.disabled = !!lesson; });
    if (!lesson) return;
    $('title').textContent = t(action === 'cancel' ? 'manageCancelTitle' : 'manageRescheduleTitle');
    $('original').textContent = `${date(lesson.startsAt, timeZone, true)} · ${timeZone}`;
    $('policy').textContent = t(action === 'cancel' ? (acceptLoss ? 'manageCancelLate' : 'manageCancelEarly') :
      (acceptLoss ? 'manageMoveLate' : 'manageMoveEarly'));
    $('picker').hidden = action !== 'reschedule';
    renderSlotOptions($('day'), $('slot'), slots, day, slot, timeZone);
    $('day').disabled = busy || uncertain; $('slot').disabled = busy || uncertain || !day;
    $('day').required = $('slot').required = action === 'reschedule';
    $('zone').textContent = `${t('timezone')} ${timeZone}`;
    const selected = slots.find(item => item.id === slot);
    $('summary').textContent = selected ? `${t('manageNewTime')}: ${date(selected.startAt, timeZone, true)} · ${timeZone}` : '';
    $('confirm').disabled = busy || (action === 'reschedule' && !selected);
    $('confirm').textContent = t(busy ? 'manageSending' : uncertain ? 'bookRetry' : action === 'cancel' ? 'manageConfirmCancel' : 'manageConfirmMove');
    $('close').disabled = busy || uncertain;
  }
  function clear() {
    ++version; lesson = null; action = ''; slots = []; day = ''; slot = ''; busy = false;
    uncertain = false; message = ''; failed = false; $('form').hidden = true;
    for (const id of ['status','original','summary','policy','day','slot']) $(id).replaceChildren();
    render();
  }
  function close() {
    if (busy || uncertain) return;
    const returnTo = opener; clear();
    if (returnTo?.isConnected) returnTo.focus();
    else document.getElementById('upcoming-title').focus();
  }
  function authError(e) {
    if (['SIGNED_OUT','DENIED','STUDENT_NOT_FOUND'].includes(e.code)) { denied(); return true; }
    return false;
  }
  async function available(keepMessage = false) {
    const current = ++version; busy = true;
    if (!keepMessage) message = 'bookLoading'; render();
    try {
      const items = await service.availableSlots();
      if (current !== version) return;
      slots = items; day = ''; slot = '';
      if (!items.length) message = 'bookEmpty'; else if (!keepMessage) message = '';
    } catch (e) { if (current === version && !authError(e)) { message = 'unavailable'; failed = true; } }
    finally { if (current === version) { busy = false; render(); } }
  }
  async function open(kind, item, button) {
    if (busy || uncertain) return;
    clear(); lesson = item; action = kind; opener = button;
    // Display estimate only. Server checks again and requires renewed consent at the boundary.
    acceptLoss = Date.parse(item.startsAt) - Date.now() < 12 * 60 * 60 * 1000;
    $('form').hidden = false; render(); $('title').focus();
    if (action === 'reschedule') await available();
  }
  $('day').addEventListener('change', () => { day = $('day').value; slot = ''; render(); });
  $('slot').addEventListener('change', () => { slot = $('slot').value; render(); });
  $('close').addEventListener('click', close);
  $('form').addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  $('form').addEventListener('submit', async event => {
    event.preventDefault(); if (!lesson || busy || (action === 'reschedule' && !slot)) return;
    const current = ++version; busy = true; notice('manageSending');
    try {
      const receipt = action === 'cancel' ? await service.cancelClass(lesson.id, acceptLoss) :
        await service.rescheduleClass(lesson.id, slot, timeZone, acceptLoss);
      if (current !== version) return;
      await refresh();
      if (!document.getElementById('portal-content').hidden) {
        notice(receipt.action === 'reschedule' ? 'manageMoved' : receipt.creditOutcome === 'returned' ? 'manageCancelledReturned' : 'manageCancelledConsumed');
        $('status').tabIndex = -1; $('status').focus();
      }
    } catch (e) {
      if (current !== version || authError(e)) return;
      busy = false;
      if (e.code === 'CREDIT_LOSS_CONFIRMATION_REQUIRED') {
        uncertain = false; acceptLoss = true; notice('manageBoundary', true); $('confirm').focus();
      } else if (['SLOT_UNAVAILABLE','INVALID_SLOT','BOOKING_TOO_SOON'].includes(e.code)) {
        uncertain = false; notice('manageTaken', true); await available(true);
      } else if (['BOOKING_ALREADY_CANCELLED','BOOKING_NOT_FOUND','BOOKING_NOT_UPCOMING','BOOKING_NOT_MANAGEABLE'].includes(e.code)) {
        await refresh();
        if (!document.getElementById('portal-content').hidden) notice('manageChanged', true);
      } else if (e.code === 'NO_AVAILABLE_CREDITS') {
        uncertain = false; notice('manageCredit', true);
      } else if (['IDEMPOTENCY_CONFLICT','INVALID_REQUEST','INVALID_PLAN','SAME_SLOT','RATE_LIMITED'].includes(e.code)) {
        uncertain = false; notice(e.code === 'RATE_LIMITED' ? 'bookLimit' : 'manageConflict', true);
      } else { uncertain = true; notice('manageUncertain', true); }
    } finally { if (current === version) { busy = false; render(); } }
  });
  return { open, clear, render };
}
