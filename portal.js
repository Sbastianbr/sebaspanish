import { portalService, PORTAL_URL } from './portal-client.js';
import { createPortalBooking } from './portal-booking.js';
import { t, date, money, watchLanguage } from './portal-i18n.js';

const $ = (id) => document.getElementById(id);
const isAccess = document.body.dataset.portalPage === 'access';
let booking, service, snapshot = null, generation = 0, expiryTimer, signingOut = false;
let statusKey = 'loading', statusError = false, sending = false;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function status(key, error = false) {
  statusKey = key; statusError = error;
  $('portal-status').textContent = key ? t(key) : '';
  $('portal-status').hidden = !key;
  $('portal-status').dataset.error = String(error);
}
function clearPrivate() {
  snapshot = null;
  booking?.clear();
  clearTimeout(expiryTimer);
  if (!$('portal-content')) return;
  $('portal-content').hidden = true;
  for (const id of ['portal-greeting', 'portal-profile', 'portal-upcoming', 'portal-history', 'portal-purchases',
    'portal-expiry', 'portal-review', 'credits-available', 'credits-reserved', 'credits-consumed', 'credits-expired']) {
    $(id).replaceChildren();
  }
}
function badge(value) {
  const item = el('span', t(value), 'portal-badge');
  item.dataset.status = value;
  return item;
}
function lessons(id, items) {
  $(id).replaceChildren(...items.map((lesson) => {
    const item = el('li');
    const row = el('div', undefined, 'portal-row');
    row.append(el('strong', date(lesson.startsAt, timeZone, true)), badge(lesson.status));
    item.append(row, el('p', `${t(lesson.type)} · ${t('duration', { minutes: lesson.durationMinutes })}`, 'portal-note'));
    return item;
  }));
  $(id.replace('portal-', 'empty-')).hidden = items.length > 0;
}
function render() {
  status(statusKey, statusError);
  if ($('portal-send')) $('portal-send').textContent = t(sending ? 'sending' : 'send');
  if (!snapshot || isAccess) return;
  const { profile, credits, purchases, upcoming, history } = snapshot;
  $('portal-greeting').textContent = t('greeting', { name: profile.name });
  for (const key of ['available', 'reserved', 'consumed', 'expired']) $('credits-' + key).textContent = credits[key];
  $('portal-expiry').textContent = credits.nextExpiry ? `${t('nextExpiry')}: ${date(credits.nextExpiry, timeZone, true)}` : t('noExpiry');
  $('portal-review').hidden = !credits.returnedPendingReview;
  $('portal-review').textContent = `${t('review')}: ${credits.returnedPendingReview}`;
  $('portal-timezone').textContent = `${t('timezone')} ${timeZone}`;
  $('portal-profile').replaceChildren(...[
    ['name', profile.name], ['email', profile.email], ['language', t(profile.language)],
    ['country', profile.country], ['level', profile.spanishLevel],
  ].map(([label, value]) => {
    const row = el('div'); row.append(el('dt', t(label)), el('dd', value || t('unspecified'))); return row;
  }));
  lessons('portal-upcoming', upcoming);
  lessons('portal-history', history);
  $('portal-purchases').replaceChildren(...purchases.map((purchase) => {
    const item = el('li'), row = el('div', undefined, 'portal-row');
    row.append(el('strong', t(purchase.offer)), badge(purchase.status));
    item.append(row, el('strong', money(purchase.priceMinor, purchase.currency)),
      el('p', `${t(purchase.activatedAt ? 'activated' : 'created')}: ${date(purchase.activatedAt || purchase.createdAt, timeZone)}`, 'portal-note'));
    if (purchase.expiresAt) item.append(el('p', `${t('expires')}: ${date(purchase.expiresAt, timeZone)}`, 'portal-note'));
    return item;
  }));
  $('empty-purchases').hidden = purchases.length > 0;
  $('portal-content').hidden = false;
  booking?.render(credits.available);
}
function accessRedirect(reason) {
  clearPrivate();
  // Fixed relative destinations only. No tokens, email, next URL or student IDs.
  location.replace(`acceso.html${reason ? '?' + new URLSearchParams({ state: reason }) : ''}`);
}
async function load() {
  if (signingOut) return;
  const current = ++generation;
  clearPrivate(); status('loading'); $('portal-retry').hidden = true;
  try {
    if (isAccess) {
      await service.completeAccess();
      if (current === generation) location.replace('mis-clases.html');
      return;
    }
    const result = await service.snapshot();
    if (current !== generation || signingOut) return;
    snapshot = result.data;
    $('portal-logout').hidden = false;
    status(''); render();
    // Hide/recheck at token expiry even if the device went offline while idle.
    expiryTimer = setTimeout(load, Math.max(1000, result.expiresAt * 1000 - Date.now() + 100));
  } catch (error) {
    if (current !== generation || signingOut) return;
    clearPrivate();
    if (['SIGNED_OUT', 'DENIED', 'INVALID_LINK'].includes(error.code)) {
      if (!isAccess) { accessRedirect(error.code === 'DENIED' ? 'denied' : 'expired'); return; }
      $('portal-access-form').hidden = false;
      const state = new URLSearchParams(location.search).get('state');
      status(error.code === 'DENIED' ? 'denied' : ['expired', 'loggedOut', 'denied'].includes(state) ? state : '', error.code === 'DENIED');
      // A non-eligible existing session must still be able to sign out/change account.
      $('portal-logout').hidden = error.code === 'SIGNED_OUT';
    } else {
      status('unavailable', true); $('portal-retry').hidden = false;
      $('portal-logout').hidden = false;
    }
  }
}
async function logout() {
  if (signingOut) return;
  signingOut = true; ++generation; clearPrivate(); status('loading');
  $('portal-logout').disabled = true;
  try {
    await service.logout();
    accessRedirect('loggedOut');
  } catch {
    signingOut = false; $('portal-logout').disabled = false;
    status('unavailable', true);
  }
}
watchLanguage(render);
try {
  service = portalService();
  if (!isAccess) booking = createPortalBooking({ service, timeZone, refresh: load,
    denied: () => accessRedirect('expired') });
  // Do not call async Auth methods inside onAuthStateChange: its session lock is held.
  service.subscribe((event) => {
    if (event === 'SIGNED_OUT') {
      ++generation; clearPrivate();
      if (!signingOut) accessRedirect('expired');
    } else if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
      setTimeout(load, 0);
    }
  });
  $('portal-logout').addEventListener('click', logout);
  $('portal-retry').addEventListener('click', load);
  window.addEventListener('pagehide', () => { ++generation; clearPrivate(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ++generation; clearPrivate(); }
    else load();
  });
  $('portal-access-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    sending = true; $('portal-send').disabled = true; status('sending'); render();
    try {
      const response = await fetch(`${PORTAL_URL}/functions/v1/portal-access-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('portal-email').value.trim().toLowerCase() }),
        signal: AbortSignal.timeout(15000), cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      status('sent');
    } catch { status('unavailable', true); }
    finally { sending = false; $('portal-send').disabled = false; render(); }
  });
  load();
} catch { status('unavailable', true); }
