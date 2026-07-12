import {
  dayKey,
  parseDayKey,
  formatHours,
  isSameWeek,
  weekStart,
  shiftWeek,
  shiftMonth,
  weekRangeLabel,
  monthYearLabel,
  monthLabel,
  isCurrentWeek,
  daysInMonthGrid,
  isDayOff,
  dayOffCountInMonth,
  dayOffCountInYear,
  entriesInWeek,
  sumHours,
  sumRegular,
  sumOvertime,
  overtimeHours,
  regularHours,
  filterEntriesByMonth,
  filterEntriesByYear,
  REGULAR_HOURS_CAP,
  HOURS_STEP,
  snapHours
} from './utils.js';

import {
  loadState,
  saveState,
  getEntry,
  upsertEntry,
  deleteEntry,
  deleteEntries,
  saveLastHours,
  setDarkMode,
  nightShiftDefault,
  carryNightShiftToNextDay,
  exportBackup,
  importBackup,
  allEntriesSorted
} from './store.js';

function iconChevron(direction) {
  const points = direction === 'left' ? '15 6 9 12 15 18' : '9 6 15 12 9 18';
  return `<svg class="icon-btn-glyph" viewBox="0 0 24 24" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;
}

function iconClose() {
  return `<svg class="icon-btn-glyph icon-btn-glyph-solid" viewBox="0 0 24 24" aria-hidden="true"><rect x="11" y="5" width="2" height="14" rx="1" transform="rotate(45 12 12)"></rect><rect x="11" y="5" width="2" height="14" rx="1" transform="rotate(-45 12 12)"></rect></svg>`;
}

function iconMinus() {
  return `<svg class="stepper-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="2" rx="1"></rect></svg>`;
}

function iconPlus() {
  return `<svg class="stepper-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="11" y="5" width="2" height="14" rx="1"></rect><rect x="5" y="11" width="14" height="2" rx="1"></rect></svg>`;
}

function iconNightShift(className = 'tab-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 13.3A8.5 8.5 0 1 1 10.7 3 6.5 6.5 0 0 0 21 13.3z"></path>
    <path d="M18.5 2.5l.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z"></path>
    <path d="M5 5l.4.8.8.4-.8.4-.4.8-.4-.8-.8-.4.8-.4z"></path>
  </svg>`;
}

function dayCellClasses({ today, outside, multi, off, hours, isNight, overtime }) {
  const classes = ['day-cell'];
  if (today) classes.push('today');
  if (outside) classes.push('outside-month');
  if (multi) classes.push('multi-selected');
  if (off) classes.push('day-off');
  if (hours > 0) {
    classes.push('has-hours', isNight ? 'night-shift' : 'day-shift');
    if (overtime) classes.push('overtime');
  }
  return classes.join(' ');
}

const ui = {
  calendar: document.getElementById('panel-calendar'),
  summary: document.getElementById('panel-summary'),
  settings: document.getElementById('panel-settings'),
  modalRoot: document.getElementById('modal-root'),
  tabs: document.querySelectorAll('.tab-btn')
};

const state = {
  data: loadState(),
  displayedMonth: new Date(),
  selectedWeek: new Date(),
  selectMode: false,
  multiSelected: new Set(),
  summaryMonth: new Date(),
  yearViewYear: new Date().getFullYear(),
  yearViewScrollTop: 0
};

function renderAll() {
  applyTheme();
  renderCalendar();
  renderSummary();
  renderSettings();
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', !!state.data.settings.isDarkMode);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function activeTab() {
  return [...ui.tabs].find((button) => button.classList.contains('active'))?.dataset.tab ?? 'calendar';
}

function setTab(tab) {
  const previousTab = activeTab();

  if (previousTab === 'summary' && tab !== 'summary') {
    state.summaryMonth = monthStart(new Date());
  }

  if (previousTab === 'calendar' && tab !== 'calendar') {
    state.displayedMonth = monthStart(new Date());
    state.selectedWeek = new Date();
  }

  ui.tabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  ui.calendar.classList.toggle('active', tab === 'calendar');
  ui.summary.classList.toggle('active', tab === 'summary');
  ui.settings.classList.toggle('active', tab === 'settings');

  if (tab === 'calendar') {
    renderCalendar();
  } else if (tab === 'summary') {
    renderSummary();
  }
}

function bindHorizontalSwipe(element, onSwipe, { disabled = () => false } = {}) {
  if (!element) return;

  let startX = null;

  element.addEventListener('touchstart', (event) => {
    if (disabled()) return;
    startX = event.changedTouches[0].clientX;
  }, { passive: true });

  element.addEventListener('touchend', (event) => {
    if (startX == null || disabled()) return;
    const delta = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(delta) < 60) return;
    onSwipe(delta < 0 ? 1 : -1);
  }, { passive: true });
}

function renderCalendar() {
  const month = state.displayedMonth;
  const entries = state.data.entries;

  ui.calendar.innerHTML = `
    <div class="stack">
      <div id="month-swipe-area" class="stack">
        <div class="row spread month-header">
          <button class="icon-btn" data-action="prev-month" aria-label="Previous month">${iconChevron('left')}</button>
          <div class="month-title">
            ${monthLabel(month)}
            <button class="year-link" data-action="open-year" type="button">${month.getFullYear()}</button>
          </div>
          <div class="row">
            <button class="icon-btn" data-action="next-month" aria-label="Next month">${iconChevron('right')}</button>
            <button class="chip-btn" data-action="toggle-select" type="button">${state.selectMode ? 'Done' : 'Select'}</button>
          </div>
        </div>

        ${state.selectMode ? `
          <div class="select-banner row spread">
            <span data-select-text>${selectBannerText()}</span>
            <div class="row" data-select-actions>
              ${state.multiSelected.size ? '<button class="chip-btn" data-action="clear-selection" type="button">Clear</button><button class="primary-btn" data-action="bulk-save" type="button">Save Hours</button>' : ''}
            </div>
          </div>
        ` : ''}

        <div id="calendar-grid" class="stack ${state.selectMode ? 'select-mode' : ''}">
          <div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => `<div>${d}</div>`).join('')}</div>
          ${renderMonthWeeks(month, entries)}
        </div>
      </div>

      <div class="legend">
        <span class="legend-item"><span class="dot" style="background:var(--day)"></span>Day shift</span>
        <span class="legend-item"><span class="dot" style="background:var(--night)"></span>Night shift</span>
        <span class="legend-item"><span class="dot" style="box-shadow:inset 0 0 0 1.5px var(--danger)"></span>Overtime</span>
        <span class="legend-item"><span class="dot day-off-dot"></span>Day off</span>
        ${state.selectMode ? '<span class="legend-item"><span class="dot" style="background:#2563eb"></span>Selected</span>' : ''}
      </div>

      ${renderWeekPicker()}
      <p class="hint">Tap a day in the selected week to log hours. Tap another week to switch selection.</p>
      ${renderWeekSummary()}
    </div>
  `;

  bindCalendarEvents();
}

function renderMonthWeeks(month, entries) {
  const days = daysInMonthGrid(month);
  const rows = [];

  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const selectedWeekRow = slice.some((day) => day && isSameWeek(day, state.selectedWeek));
    rows.push(`
      <div class="week-row-wrap ${selectedWeekRow ? 'selected-week' : ''}">
        <div class="week-row">
          ${slice.map((day, offset) => renderDayCell(day, entries, i + offset, month)).join('')}
        </div>
      </div>
    `);
  }

  return rows.join('');
}

function renderDayCell(day, entries, index, month) {
  if (!day) return '<div class="day-cell empty"></div>';

  const key = dayKey(day);
  const entry = entries[key];
  const hours = entry?.hours || 0;
  const isNight = !!entry?.isNightShift;
  const hasNotes = !!entry?.notes;
  const today = dayKey(day) === dayKey(new Date());
  const outside = day.getMonth() !== month.getMonth();
  const multi = state.multiSelected.has(key);
  const off = isDayOff(day, entry);
  const overtime = hours > REGULAR_HOURS_CAP;

  let badge = '<span style="height:12px"></span>';
  if (hours > 0) {
    badge = `<span class="badge ${isNight ? 'night' : 'day'} ${overtime ? 'overtime' : ''}">${formatHours(hours, 1)}</span>`;
  } else if (off) {
    badge = '<span class="badge off">off</span>';
  }

  return `
    <div
      class="${dayCellClasses({ today, outside, multi, off, hours, isNight, overtime })}"
      data-day="${key}"
      data-index="${index}"
      role="button"
      tabindex="0"
    >
      <div class="day-number-line">
        <span class="day-number">${day.getDate()}</span>
        ${hasNotes ? '<span class="note-mark">*</span>' : ''}
      </div>
      ${badge}
    </div>
  `;
}

function renderWeekPicker() {
  const current = isCurrentWeek(state.selectedWeek);
  return `
    <div class="card week-picker-card" id="week-swipe-area">
      <div class="row spread">
        <button class="icon-btn" data-action="prev-week" aria-label="Previous week">${iconChevron('left')}</button>
        <button class="week-picker-label" data-action="jump-current-week" type="button">
          <div class="week-picker-range">${weekRangeLabel(state.selectedWeek)}</div>
          ${current
            ? '<div class="hint">Current Week</div>'
            : '<div class="hint week-picker-jump">Jump to Current Week</div>'}
        </button>
        <button class="icon-btn" data-action="next-week" aria-label="Next week">${iconChevron('right')}</button>
      </div>
    </div>
  `;
}

function renderWeekSummary() {
  const items = entriesInWeek(state.selectedWeek, state.data.entries);
  return `
    <div class="stack">
      <div class="section-title">Week of ${weekRangeLabel(state.selectedWeek)}</div>
      <div class="stat-grid">
        ${statBox('Total', formatHours(sumHours(items), 1))}
        ${statBox('Regular', formatHours(sumRegular(items), 1), 'green')}
        ${statBox('Overtime', formatHours(sumOvertime(items), 1), 'red')}
      </div>
    </div>
  `;
}

function statBox(label, value, tone = '') {
  return `<div class="stat-box ${tone}"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

function renderSummary() {
  const monthItems = filterEntriesByMonth(state.data.entries, state.summaryMonth);
  const yearItems = filterEntriesByYear(state.data.entries, state.summaryMonth);
  const entries = allEntriesSorted(state.data);

  ui.summary.innerHTML = `
    <div class="stack" id="summary-swipe-area">
      <div class="row spread month-header">
        <button class="icon-btn" data-action="summary-prev-month" aria-label="Previous month">${iconChevron('left')}</button>
        <div class="month-title">${monthYearLabel(state.summaryMonth)}</div>
        <button class="icon-btn" data-action="summary-next-month" aria-label="Next month">${iconChevron('right')}</button>
      </div>

      <section>
        <h2 class="section-title">Totals</h2>
        <div class="list-card">
          ${summaryRow(monthLabel(state.summaryMonth), `${formatHours(sumHours(monthItems), 1)} hrs`)}
          ${summaryRow(String(state.summaryMonth.getFullYear()), `${formatHours(sumHours(yearItems), 1)} hrs`)}
        </div>
      </section>

      <section>
        <h2 class="section-title">Regular Hours</h2>
        <div class="list-card">
          ${summaryRow(monthLabel(state.summaryMonth), `${formatHours(sumRegular(monthItems), 1)} hrs`, 'green')}
          ${summaryRow(String(state.summaryMonth.getFullYear()), `${formatHours(sumRegular(yearItems), 1)} hrs`, 'green')}
        </div>
      </section>

      <section>
        <h2 class="section-title">Overtime</h2>
        <div class="list-card">
          ${summaryRow(monthLabel(state.summaryMonth), `${formatHours(sumOvertime(monthItems), 1)} hrs`, 'red')}
          ${summaryRow(String(state.summaryMonth.getFullYear()), `${formatHours(sumOvertime(yearItems), 1)} hrs`, 'red')}
        </div>
      </section>

      <section>
        <h2 class="section-title">Days Off</h2>
        <div class="list-card">
          ${summaryRow(monthLabel(state.summaryMonth), `${dayOffCountInMonth(state.summaryMonth, state.data.entries)} days`)}
          ${summaryRow(String(state.summaryMonth.getFullYear()), `${dayOffCountInYear(state.summaryMonth.getFullYear(), state.data.entries)} days`)}
        </div>
      </section>

      <section>
        <h2 class="section-title">All Entries</h2>
        <div class="list-card">
          ${entries.length ? entries.map(entryRow).join('') : '<div class="list-row"><span class="meta">No hours logged yet.</span></div>'}
        </div>
      </section>
    </div>
  `;

  bindSummaryEvents();
}

function summaryRow(title, value, tone = '') {
  return `<div class="list-row spread"><span>${title}</span><strong class="summary-value ${tone}">${value}</strong></div>`;
}

function entryRow(entry) {
  const date = parseDayKey(entry.date).toLocaleDateString();
  const ot = overtimeHours(entry.hours) > 0 ? `<div class="meta" style="color:#f97316">+${formatHours(overtimeHours(entry.hours))} OT</div>` : '';
  return `
    <div class="list-row">
      <div>
        <div class="entry-title">${date}${entry.notes ? ' *' : ''}${entry.isNightShift ? `<span class="night-shift-mark">${iconNightShift('legend-icon')}</span>` : ''}</div>
        ${entry.notes ? `<div class="meta">${escapeHtml(entry.notes)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div>${formatHours(entry.hours)} hrs</div>
        ${ot}
      </div>
    </div>
  `;
}

function renderSettings() {
  ui.settings.innerHTML = `
    <div class="stack settings-stack">
      <section class="card">
        <label class="row spread">
          <span>Dark Mode</span>
          <input id="dark-mode-toggle" type="checkbox" ${state.data.settings.isDarkMode ? 'checked' : ''} />
        </label>
      </section>

      <section class="card stack">
        <button class="primary-btn" data-action="export-backup" type="button">Export Backup</button>
        <label class="primary-btn" style="display:block;text-align:center;cursor:pointer">
          Import Backup
          <input id="import-backup" type="file" accept="application/json,.json" hidden />
        </label>
        <p class="hint">Export creates a JSON file with all logged shifts. Import merges entries by date.</p>
        <p id="backup-status" class="hint"></p>
      </section>

      <p class="settings-footer">2026 © AU</p>
    </div>
  `;

  bindSettingsEvents();
}

function captureYearModalScroll() {
  const sheet = ui.modalRoot.querySelector('[data-modal="year"] .modal-sheet');
  if (sheet) state.yearViewScrollTop = sheet.scrollTop;
}

function restoreYearModalScroll(sheet) {
  if (!sheet) return;
  requestAnimationFrame(() => {
    sheet.scrollTop = state.yearViewScrollTop;
  });
}

function openLogModal(dates, { returnToYearView = false } = {}) {
  if (returnToYearView) captureYearModalScroll();
  const list = Array.isArray(dates) ? dates : [dates];
  const primary = list[0];
  const existing = getEntry(state.data, primary);
  const bulk = list.length > 1;

  let hours = state.data.settings.lastHours || 8;
  let notes = '';
  let isNightShift = nightShiftDefault(state.data, primary);

  if (!bulk && existing) {
    hours = existing.hours;
    notes = existing.notes;
    isNightShift = existing.isNightShift;
  }

  const dismiss = (changed = false) => {
    ui.modalRoot.innerHTML = '';
    if (returnToYearView) {
      if (changed) renderAll();
      openYearModal({ restoreScroll: true });
      return;
    }
    if (changed) renderAll();
  };

  ui.modalRoot.innerHTML = `
    <div class="modal-backdrop open" data-modal="log">
      <div class="modal-sheet">
        <div class="modal-header">
          <strong>${bulk ? `Fill ${list.length} days` : parseDayKey(dayKey(primary)).toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</strong>
          <button class="icon-btn" data-action="close-modal" type="button" aria-label="Close">${iconClose()}</button>
        </div>

        <div class="form-group">
          <button class="chip-btn night-toggle ${isNightShift ? 'active' : ''}" data-action="toggle-night" type="button">${iconNightShift()} Night Shift</button>
        </div>

        <div class="form-group">
          <label>Hours Worked</label>
          <div class="range-row">
            <button class="stepper-btn" data-action="hours-minus" type="button" aria-label="Decrease hours">${iconMinus()}</button>
            <div class="hours-input-field">
              <input
                id="hours-input"
                class="hours-input"
                type="text"
                inputmode="decimal"
                enterkeyhint="done"
                autocomplete="off"
                value="${formatHours(hours, 1)}"
                aria-label="Hours worked"
              />
              <span class="hours-input-suffix">hrs</span>
            </div>
            <button class="stepper-btn" data-action="hours-plus" type="button" aria-label="Increase hours">${iconPlus()}</button>
          </div>
          <input id="hours-slider" class="form-control" type="range" min="0" max="24" step="${HOURS_STEP}" value="${hours}" />
          <p id="overtime-hint" class="hint overtime-hint"${hours > REGULAR_HOURS_CAP ? '' : ' hidden'}>${hours > REGULAR_HOURS_CAP ? `${formatHours(regularHours(hours), 1)} hrs regular + ${formatHours(overtimeHours(hours), 1)} hrs overtime` : ''}</p>
        </div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="notes-input" class="form-control" rows="3">${escapeHtml(notes)}</textarea>
        </div>

        ${(!bulk && existing) || (bulk && list.some((d) => getEntry(state.data, d))) ? '<button class="danger-btn" data-action="delete-entry" type="button">Delete Entry</button>' : ''}

        <div class="row spread" style="margin-top:16px">
          <button class="chip-btn" data-action="close-modal" type="button">Cancel</button>
          <button class="primary-btn" data-action="save-entry" type="button">Save</button>
        </div>
      </div>
    </div>
  `;

  const modal = ui.modalRoot.querySelector('[data-modal="log"]');
  let currentHours = hours;
  let currentNight = isNightShift;
  const hoursInput = modal.querySelector('#hours-input');

  const parseHoursInput = (value) => {
    const cleaned = String(value).trim().replace(/[^\d.]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : currentHours;
  };

  const commitHoursInput = () => {
    updateHours(parseHoursInput(hoursInput.value));
  };

  const updateHours = (value) => {
    currentHours = snapHours(Math.min(24, Math.max(0, value)));
    hoursInput.value = formatHours(currentHours, 1);
    modal.querySelector('#hours-slider').value = currentHours;

    const hint = modal.querySelector('#overtime-hint');
    if (currentHours > REGULAR_HOURS_CAP) {
      hint.textContent = `${formatHours(regularHours(currentHours), 1)} hrs regular + ${formatHours(overtimeHours(currentHours), 1)} hrs overtime`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  };

  hoursInput.addEventListener('focus', () => {
    requestAnimationFrame(() => hoursInput.select());
  });

  hoursInput.addEventListener('blur', commitHoursInput);

  hoursInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      hoursInput.blur();
    }
  });

  modal.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'close-modal') {
      dismiss(false);
      return;
    }

    if (action === 'toggle-night') {
      currentNight = !currentNight;
      modal.querySelector('[data-action="toggle-night"]').classList.toggle('active', currentNight);
      return;
    }

    if (action === 'hours-minus') {
      updateHours(currentHours - HOURS_STEP);
      return;
    }

    if (action === 'hours-plus') {
      updateHours(currentHours + HOURS_STEP);
      return;
    }

    if (action === 'save-entry') {
      commitHoursInput();

      const payload = {
        hours: currentHours,
        notes: modal.querySelector('#notes-input').value.trim(),
        isNightShift: currentNight
      };

      list.forEach((date) => upsertEntry(state.data, date, payload));
      saveLastHours(state.data, currentHours);
      carryNightShiftToNextDay(state.data, list[list.length - 1], currentNight);

      state.selectMode = false;
      state.multiSelected.clear();
      dismiss(true);
      return;
    }

    if (action === 'delete-entry') {
      if (bulk) {
        deleteEntries(state.data, list.filter((d) => getEntry(state.data, d)));
      } else {
        deleteEntry(state.data, primary);
        carryNightShiftToNextDay(state.data, primary, false);
      }
      dismiss(true);
    }
  });

  modal.querySelector('#hours-slider').addEventListener('input', (event) => {
    updateHours(Number(event.target.value));
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) dismiss(false);
  });
}

function openYearModal({ restoreScroll = false } = {}) {
  const year = state.yearViewYear;

  ui.modalRoot.innerHTML = `
    <div class="modal-backdrop open" data-modal="year">
      <div class="modal-sheet">
        <div class="modal-header">
          <div class="row">
            <button class="icon-btn" data-action="prev-year" type="button" aria-label="Previous year">${iconChevron('left')}</button>
            <strong>${year}</strong>
            <button class="icon-btn" data-action="next-year" type="button" aria-label="Next year">${iconChevron('right')}</button>
          </div>
          <button class="icon-btn" data-action="close-modal" type="button" aria-label="Close">${iconClose()}</button>
        </div>
        ${renderYearSummary(year)}
        <div>${renderYearMonths(year)}</div>
      </div>
    </div>
  `;

  const modal = ui.modalRoot.querySelector('[data-modal="year"]');
  const sheet = modal.querySelector('.modal-sheet');
  if (restoreScroll) restoreYearModalScroll(sheet);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      ui.modalRoot.innerHTML = '';
      return;
    }

    const dayCell = event.target.closest('[data-year-day]');
    if (dayCell) {
      openLogModal(parseDayKey(dayCell.dataset.yearDay), { returnToYearView: true });
      return;
    }

    const monthButton = event.target.closest('[data-month]');
    if (monthButton) {
      const [y, m] = monthButton.dataset.month.split('-').map(Number);
      state.displayedMonth = new Date(y, m, 1);
      ui.modalRoot.innerHTML = '';
      setTab('calendar');
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'close-modal') {
      ui.modalRoot.innerHTML = '';
      return;
    }

    if (action === 'prev-year') {
      state.yearViewYear -= 1;
      state.yearViewScrollTop = 0;
      openYearModal();
      return;
    }

    if (action === 'next-year') {
      state.yearViewYear += 1;
      state.yearViewScrollTop = 0;
      openYearModal();
    }
  });
}

function renderYearSummary(year) {
  const yearItems = filterEntriesByYear(state.data.entries, new Date(year, 0, 1));
  return `
    <div class="stat-grid four" style="margin-bottom:16px">
      ${statBox('Total', formatHours(sumHours(yearItems), 1))}
      ${statBox('Regular', formatHours(sumRegular(yearItems), 1), 'green')}
      ${statBox('Overtime', formatHours(sumOvertime(yearItems), 1), 'red')}
      ${statBox('Days Off', String(dayOffCountInYear(year, state.data.entries)), 'muted')}
    </div>
  `;
}

function renderYearMonths(year) {
  let html = '';
  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(year, month, 1);
    const items = filterEntriesByMonth(state.data.entries, monthDate);
    const dayoffs = dayOffCountInMonth(monthDate, state.data.entries);
    const days = daysInMonthGrid(monthDate);

    html += `
      <section class="month-block">
        <button class="row spread" data-month="${year}-${month}" type="button" style="width:100%;border:none;background:transparent;color:inherit;padding:0;margin-bottom:8px;cursor:pointer">
          <strong>${monthLabel(monthDate)}</strong>
          <span class="hint">${formatHours(sumHours(items), 1)} hrs${dayoffs ? ` · ${dayoffs} dayoffs` : ''}</span>
        </button>
        <div class="compact-grid">
          ${days.map((day) => {
            if (!day) return '<div class="day-cell empty"></div>';

            const key = dayKey(day);
            const entry = state.data.entries[key];
            const hours = entry?.hours || 0;
            const off = isDayOff(day, entry);
            const overtime = hours > REGULAR_HOURS_CAP;
            const badge = hours > 0
              ? `<span class="badge ${entry.isNightShift ? 'night' : 'day'} ${overtime ? 'overtime' : ''}">${formatHours(hours, 1)}</span>`
              : (off ? '<span class="badge off">off</span>' : '');
            return `
              <div
                class="${dayCellClasses({ today: false, outside: false, multi: false, off, hours, isNight: !!entry?.isNightShift, overtime })}"
                data-year-day="${key}"
                role="button"
                tabindex="0"
              >
                <div class="day-number-line">
                  <span>${day.getDate()}</span>
                  ${entry?.notes ? '<span class="note-mark">*</span>' : ''}
                </div>
                ${badge}
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }
  return html;
}

function selectBannerText() {
  const count = state.multiSelected.size;
  if (!count) return 'Tap and drag across days to select';
  if (count === 1) return '1 day selected';
  return `${count} days selected`;
}

function bindCalendarEvents() {
  ui.calendar.onclick = (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      event.preventDefault();
      handleCalendarAction(actionEl.dataset.action);
      return;
    }

    if (state.selectMode) return;

    const cell = event.target.closest('[data-day]');
    if (!cell) return;
    handleDayTap(cell.dataset.day);
  };

  const grid = ui.calendar.querySelector('#calendar-grid');

  bindHorizontalSwipe(
    ui.calendar.querySelector('#month-swipe-area'),
    (direction) => {
      state.displayedMonth = shiftMonth(state.displayedMonth, direction);
      renderCalendar();
    },
    { disabled: () => state.selectMode }
  );

  bindHorizontalSwipe(
    ui.calendar.querySelector('#week-swipe-area'),
    (direction) => {
      selectWeek(shiftWeek(state.selectedWeek, direction));
      renderCalendar();
    }
  );

  if (state.selectMode) bindSelectDrag(grid);
}

function updateSelectBanner() {
  const banner = ui.calendar.querySelector('.select-banner');
  if (!banner) return;

  const text = banner.querySelector('[data-select-text]');
  if (text) text.textContent = selectBannerText();

  const actions = banner.querySelector('[data-select-actions]');
  if (actions) {
    actions.innerHTML = state.multiSelected.size
      ? '<button class="chip-btn" data-action="clear-selection" type="button">Clear</button><button class="primary-btn" data-action="bulk-save" type="button">Save Hours</button>'
      : '';
  }
}

function updateMultiSelectUI() {
  const grid = ui.calendar.querySelector('#calendar-grid');
  if (!grid) return;

  grid.querySelectorAll('[data-day]').forEach((cell) => {
    cell.classList.toggle('multi-selected', state.multiSelected.has(cell.dataset.day));
  });

  updateSelectBanner();
}

function bindSelectDrag(grid) {
  let anchorIndex = null;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  const days = daysInMonthGrid(state.displayedMonth);

  const applyRange = (start, end) => {
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    state.multiSelected = new Set(
      days.slice(lo, hi + 1).filter(Boolean).map((day) => dayKey(day))
    );
    updateMultiSelectUI();
  };

  grid.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-action]')) return;

    const cell = event.target.closest('[data-day]');
    if (!cell) return;

    event.preventDefault();
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    anchorIndex = Number(cell.dataset.index);
    grid.setPointerCapture(event.pointerId);
  });

  grid.addEventListener('pointermove', (event) => {
    if (!dragging || anchorIndex == null) return;

    if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) > 6) {
      moved = true;
    }
    if (!moved) return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const cell = target?.closest('[data-day]');
    if (!cell) return;

    applyRange(anchorIndex, Number(cell.dataset.index));
  });

  grid.addEventListener('pointerup', (event) => {
    if (!dragging) return;

    if (!moved && anchorIndex != null) {
      const day = days[anchorIndex];
      if (day) {
        const key = dayKey(day);
        const next = new Set(state.multiSelected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        state.multiSelected = next;
        updateMultiSelectUI();
      }
    }

    dragging = false;
    anchorIndex = null;

    if (grid.hasPointerCapture(event.pointerId)) {
      grid.releasePointerCapture(event.pointerId);
    }
  });

  grid.addEventListener('pointercancel', () => {
    dragging = false;
    anchorIndex = null;
  });
}

function selectWeek(date) {
  state.selectedWeek = date;
  state.displayedMonth = monthStart(date);
}

function jumpToCurrentWeek() {
  selectWeek(new Date());
}

function handleCalendarAction(action) {
  switch (action) {
    case 'prev-month':
      state.displayedMonth = shiftMonth(state.displayedMonth, -1);
      break;
    case 'next-month':
      state.displayedMonth = shiftMonth(state.displayedMonth, 1);
      break;
    case 'open-year':
      state.yearViewYear = state.displayedMonth.getFullYear();
      state.yearViewScrollTop = 0;
      openYearModal();
      return;
    case 'toggle-select':
      state.selectMode = !state.selectMode;
      state.multiSelected.clear();
      break;
    case 'clear-selection':
      state.multiSelected.clear();
      break;
    case 'bulk-save':
      openLogModal([...state.multiSelected].map(parseDayKey));
      return;
    case 'prev-week':
      selectWeek(shiftWeek(state.selectedWeek, -1));
      break;
    case 'next-week':
      selectWeek(shiftWeek(state.selectedWeek, 1));
      break;
    case 'jump-current-week':
      jumpToCurrentWeek();
      break;
    default:
      break;
  }
  renderCalendar();
}

function handleDayTap(key) {
  const date = parseDayKey(key);

  if (isSameWeek(date, state.selectedWeek)) {
    openLogModal(date);
    return;
  }

  selectWeek(date);
  renderCalendar();
}

function bindSummaryEvents() {
  ui.summary.onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'summary-prev-month') {
      state.summaryMonth = shiftMonth(state.summaryMonth, -1);
      renderSummary();
    }
    if (action === 'summary-next-month') {
      state.summaryMonth = shiftMonth(state.summaryMonth, 1);
      renderSummary();
    }
  };

  bindHorizontalSwipe(
    ui.summary.querySelector('#summary-swipe-area'),
    (direction) => {
      state.summaryMonth = shiftMonth(state.summaryMonth, direction);
      renderSummary();
    }
  );
}

function bindSettingsEvents() {
  ui.settings.querySelector('#dark-mode-toggle').addEventListener('change', (event) => {
    setDarkMode(state.data, event.target.checked);
    applyTheme();
  });

  ui.settings.querySelector('[data-action="export-backup"]').addEventListener('click', () => {
    exportBackup(state.data);
    setBackupStatus('Backup exported.');
  });

  ui.settings.querySelector('#import-backup').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const count = await importBackup(state.data, file);
      setBackupStatus(`Import complete. Restored ${count} entries.`);
      renderAll();
    } catch (error) {
      setBackupStatus(error.message, true);
    }

    event.target.value = '';
  });
}

function setBackupStatus(message, isError = false) {
  const node = ui.settings.querySelector('#backup-status');
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? 'var(--danger)' : 'var(--text-muted)';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

ui.tabs.forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

document.addEventListener('gesturestart', (event) => event.preventDefault());

let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

renderAll();
