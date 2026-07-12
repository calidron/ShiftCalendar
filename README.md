# ShiftCalendar

Shift timesheet calendar PWA — log hours, track overtime, day/night shifts, travel time and export backups.

**Live app:** https://calidron.github.io/ShiftCalendar/

## Run locally

```bash
cd web
python3 -m http.server 8080
```

Open http://localhost:8080

## Deploy

Push to `main` — GitHub Actions deploys the `web/` folder to GitHub Pages.

1. Repo **Settings → Pages → Source:** GitHub Actions
2. After the workflow runs, open the URL above

Also works on [Netlify](https://netlify.com) or [Vercel](https://vercel.com) with project root set to `web/`.
