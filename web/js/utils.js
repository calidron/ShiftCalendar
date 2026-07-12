export const REGULAR_HOURS_CAP = 8;
export const HOURS_STEP = 0.5;

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayKey(date) {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function snapHours(hours) {
  return Math.round(hours / HOURS_STEP) * HOURS_STEP;
}

export function formatHours(hours, precision = 2) {
  const snapped = snapHours(hours);
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(precision);
}

export function hourWord(hours) {
  return Number(formatHours(hours, 1)) === 1 ? 'hour' : 'hours';
}

export function isSameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

export function isSameWeek(a, b) {
  return weekStart(a).getTime() === weekStart(b).getTime();
}

export function weekStart(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function shiftWeek(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function shiftMonth(date, months) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function weekRangeLabel(date) {
  const start = weekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const sameMonth = start.getMonth() === end.getMonth();
  const opts = { month: 'short', day: 'numeric' };
  const startLabel = start.toLocaleDateString(undefined, opts);
  const endLabel = sameMonth
    ? end.getDate()
    : end.toLocaleDateString(undefined, opts);
  return `${startLabel} – ${endLabel}`;
}

export function monthYearLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long' });
}

export function isCurrentWeek(date) {
  return isSameWeek(date, new Date());
}

export function daysInMonthGrid(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const leading = (first.getDay() + 6) % 7;
  const days = Array(leading).fill(null);

  for (let d = 1; d <= last.getDate(); d += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
  }

  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function regularHours(hours) {
  return Math.min(hours, REGULAR_HOURS_CAP);
}

export function overtimeHours(hours) {
  return Math.max(hours - REGULAR_HOURS_CAP, 0);
}

export function entryRegularHours(entry) {
  if (!entry) return 0;
  if (entry.isTravelTime) return Number(entry.travelRegular) || 0;
  return regularHours(entry.hours);
}

export function entryOvertimeHours(entry) {
  if (!entry) return 0;
  if (entry.isTravelTime) return Number(entry.travelOvertime) || 0;
  return overtimeHours(entry.hours);
}

export function entryHasOvertime(entry) {
  if (!entry || entry.hours <= 0) return false;
  return entryOvertimeHours(entry) > 0;
}

export function isDayOff(date, entry) {
  const day = startOfDay(date);
  const today = startOfDay(new Date());
  if (entry) return entry.hours === 0 && day <= today;
  return day < today;
}

export function dayOffCountInMonth(monthDate, entriesByDay) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const today = startOfDay(new Date());
  let count = 0;

  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const day = startOfDay(d);
    if (day > today) continue;
    const entry = entriesByDay[dayKey(day)];
    if (isDayOff(day, entry)) count += 1;
  }

  return count;
}

export function dayOffCountInYear(year, entriesByDay) {
  let count = 0;
  for (let month = 0; month < 12; month += 1) {
    count += dayOffCountInMonth(new Date(year, month, 1), entriesByDay);
  }
  return count;
}

export function entriesInWeek(date, entriesByDay) {
  const start = weekStart(date).getTime();
  const end = start + 7 * 86400000;
  return Object.entries(entriesByDay)
    .filter(([key]) => {
      const t = parseDayKey(key).getTime();
      return t >= start && t < end;
    })
    .map(([, entry]) => entry);
}

export function sumHours(items) {
  return items.reduce((total, entry) => total + entry.hours, 0);
}

export function sumRegular(items) {
  return items.reduce((total, entry) => total + entryRegularHours(entry), 0);
}

export function sumOvertime(items) {
  return items.reduce((total, entry) => total + entryOvertimeHours(entry), 0);
}

export function filterEntriesByMonth(entriesByDay, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return Object.entries(entriesByDay)
    .filter(([key]) => {
      const d = parseDayKey(key);
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .map(([, entry]) => entry);
}

export function filterEntriesByYear(entriesByDay, date) {
  const y = date.getFullYear();
  return Object.entries(entriesByDay)
    .filter(([key]) => parseDayKey(key).getFullYear() === y)
    .map(([, entry]) => entry);
}
