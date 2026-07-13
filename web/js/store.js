import {
  dayKey,
  parseDayKey,
  snapHours,
  HOURS_STEP
} from './utils.js';

const STORAGE_KEY = 'shiftcalendar-data';
const LEGACY_STORAGE_KEY = 'timesht-data';

const defaultState = () => ({
  entries: {},
  settings: {
    isDarkMode: false,
    lastHours: 8,
    nightShiftDefaultDate: null,
    nightShiftEnabled: false
  }
});

export function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      entries: parsed.entries || {},
      settings: { ...defaultState().settings, ...parsed.settings }
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getEntry(state, date) {
  return state.entries[dayKey(date)] || null;
}

export function upsertEntry(state, date, payload) {
  const key = dayKey(date);
  const isVacation = !!payload.isVacation;

  if (isVacation) {
    state.entries[key] = {
      date: key,
      hours: 0,
      notes: payload.notes || '',
      isNightShift: false,
      isTravelTime: false,
      travelRegular: 0,
      travelOvertime: 0,
      isVacation: true
    };
    saveState(state);
    return;
  }

  const isTravelTime = !!payload.isTravelTime;
  const travelRegular = isTravelTime ? snapHours(payload.travelRegular || 0) : 0;
  const travelOvertime = isTravelTime ? snapHours(payload.travelOvertime || 0) : 0;
  const hours = isTravelTime
    ? snapHours(travelRegular + travelOvertime)
    : snapHours(payload.hours);

  state.entries[key] = {
    date: key,
    hours,
    notes: payload.notes || '',
    isNightShift: !!payload.isNightShift,
    isTravelTime,
    travelRegular: isTravelTime ? travelRegular : 0,
    travelOvertime: isTravelTime ? travelOvertime : 0,
    isVacation: false
  };
  saveState(state);
}

export function deleteEntry(state, date) {
  delete state.entries[dayKey(date)];
  saveState(state);
}

export function deleteEntries(state, dates) {
  dates.forEach((date) => delete state.entries[dayKey(date)]);
  saveState(state);
}

export function saveLastHours(state, hours) {
  state.settings.lastHours = snapHours(hours);
  saveState(state);
}

export function setDarkMode(state, enabled) {
  state.settings.isDarkMode = enabled;
  saveState(state);
}

export function nightShiftDefault(state, date) {
  if (!state.settings.nightShiftEnabled) return false;
  return state.settings.nightShiftDefaultDate === dayKey(date);
}

export function carryNightShiftToNextDay(state, date, enabled) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  const nextKey = dayKey(next);

  if (enabled) {
    state.settings.nightShiftDefaultDate = nextKey;
    state.settings.nightShiftEnabled = true;
  } else if (state.settings.nightShiftDefaultDate === nextKey) {
    state.settings.nightShiftDefaultDate = null;
    state.settings.nightShiftEnabled = false;
  }

  saveState(state);
}

export function exportBackup(state) {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: Object.values(state.entries).map((entry) => ({
      date: entry.date,
      hours: entry.hours,
      notes: entry.notes,
      isNightShift: entry.isNightShift,
      isTravelTime: !!entry.isTravelTime,
      travelRegular: entry.travelRegular || 0,
      travelOvertime: entry.travelOvertime || 0,
      isVacation: !!entry.isVacation
    }))
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `shiftcalendar-backup-${dayKey(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(state, file) {
  const text = await file.text();
  const backup = JSON.parse(text);

  if (!backup || !Array.isArray(backup.entries)) {
    throw new Error('The selected file is not a valid ShiftCalendar backup.');
  }

  if (backup.version > 1) {
    throw new Error(`Backup version ${backup.version} is not supported.`);
  }

  backup.entries.forEach((entry) => {
    const key = entry.date.includes('-') ? entry.date : dayKey(new Date(entry.date));
    state.entries[key] = {
      date: key,
      hours: snapHours(Number(entry.hours) || 0),
      notes: entry.notes || '',
      isNightShift: !!entry.isNightShift,
      isTravelTime: !!entry.isTravelTime,
      travelRegular: snapHours(Number(entry.travelRegular) || 0),
      travelOvertime: snapHours(Number(entry.travelOvertime) || 0),
      isVacation: !!entry.isVacation
    };
  });

  saveState(state);
  return backup.entries.length;
}

export function allEntriesSorted(state) {
  return Object.values(state.entries).sort((a, b) => parseDayKey(b.date) - parseDayKey(a.date));
}

export { HOURS_STEP, snapHours };
