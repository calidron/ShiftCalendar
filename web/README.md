# ShiftCalendar PWA

Progressive Web App version of the ShiftCalendar shift timesheet.

## Run locally

Serve the `web/` folder with any static server:

```bash
cd web
python3 -m http.server 8080
```

Open `http://localhost:8080`

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. Enable GitHub Pages (Settings → Pages → GitHub Actions)
3. Push to `main` — the workflow deploys `web/`

Your app will be at `https://YOUR_USER.github.io/ShiftCalendar/`

## Deploy to Vercel / Netlify

- **Vercel**: import repo, set root to `web/`
- **Netlify**: drag-and-drop the `web/` folder or connect the repo

## Features

- Calendar with day/night shift logging
- Week and year views
- Summary totals
- Dark mode
- JSON backup export/import
- Offline support (service worker)
