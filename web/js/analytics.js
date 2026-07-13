const ENDPOINT = 'https://calidron.goatcounter.com/count';
const SCRIPT_SRC = 'https://gc.zgo.at/count.js';

let scriptLoaded = false;
const pending = [];

function flushPending() {
  if (!window.goatcounter?.count) return;
  pending.splice(0).forEach((fn) => fn());
}

function trackPage(view) {
  const run = () => {
    if (!window.goatcounter?.count) return;

    const base = location.pathname.replace(/\/?index\.html$/, '').replace(/\/$/, '') || '';
    const path = `${base}/${view}`.replace(/\/{2,}/g, '/');

    window.goatcounter.count({
      path,
      title: `ShiftCalendar · ${view.charAt(0).toUpperCase()}${view.slice(1)}`
    });
  };

  if (scriptLoaded && window.goatcounter?.count) run();
  else pending.push(run);
}

export function initAnalytics() {
  if (document.querySelector('[data-shiftcalendar-analytics]')) return;

  window.goatcounter = {
    no_onload: true,
    allow_local: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    endpoint: ENDPOINT
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT_SRC;
  script.dataset.goatcounter = ENDPOINT;
  script.dataset.shiftcalendarAnalytics = 'true';
  script.onload = () => {
    scriptLoaded = true;
    flushPending();
  };
  document.head.appendChild(script);
}

export { trackPage };
