const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fromDateInput(value, { endOfDay = false } = {}) {
  if (!value) return null;
  const match = DATE_ONLY.exec(String(value));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function toLocalDateInput(value) {
  if (!value) return '';
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDueDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    return fromDateInput(value, { endOfDay: true });
  }
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
