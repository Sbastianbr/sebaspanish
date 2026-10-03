import { t, date, language } from './portal-i18n.js';
export function renderSlotOptions(daySelect, slotSelect, slots, selectedDay, selectedSlot, timeZone) {
  const dayKey = (value) => new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
  const option = (value, label) => {
    const node = document.createElement('option'); node.value = value; node.textContent = label; return node;
  };
  const days = [...new Map(slots.map(slot => [dayKey(slot.startAt), slot.startAt]))];
  daySelect.replaceChildren(option('', t('bookChoose')), ...days.map(([key, at]) => option(key, date(at, timeZone))));
  daySelect.value = selectedDay;
  slotSelect.replaceChildren(option('', t('bookChoose')), ...slots.filter(slot => dayKey(slot.startAt) === selectedDay)
    .map(slot => option(slot.id, new Intl.DateTimeFormat(language(), {
      timeZone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset',
    }).format(new Date(slot.startAt)))));
  slotSelect.value = selectedSlot;
}
