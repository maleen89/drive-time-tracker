# Drive Time Tracker

Track commute drive times between home and work on a schedule. Built for comparing Bay Area commutes (e.g. neighborhood home buys vs. work).

## Features

- **Setup** — manage locations and commute pairs (home ↔ work) with per-pair schedule slots and weekday rules
- **Scheduled measurements** — Google Routes API lookups at configured departure times
- **Route snapshots** — each measurement stores an encoded polyline and traffic intervals; detail pages render them with Leaflet (no extra routing API calls)
- **Dashboard** — latest morning/evening drive times per home, next-run countdown, manual test runs
- **History** — charts per pair, full measurement log, CSV export

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set:

- `GOOGLE_MAPS_API_KEY` — from [Google Cloud Console](https://console.cloud.google.com/) with **Routes API** enabled on the key
- `ENABLE_BUILTIN_SCHEDULER=true` — automatic runs while the Next.js server is running (local PC)
- `CRON_SECRET` — optional; required only if an external service calls `/api/cron/run`

### 3. Database

```bash
npm run db:push
npm run db:seed
```

Seed creates:

- **3 locations** — Work (Mountain View) + Fremont and Dublin homes
- **4 tracked pairs** — morning home→work and afternoon work→home for each home
- **64 schedule slots** — 7 morning times (7:00–10:00) and 9 afternoon times (14:00–18:00) per direction, Mon–Fri

Your live database may have more homes/pairs if you've added them via Setup.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Desktop shortcut (Windows)

Double-click **`Start Drive Time Tracker.bat`** in the project folder to start the dev server (if needed) and open the app in your browser.

Pin to desktop: right-click the `.bat` file → **Send to** → **Desktop (create shortcut)**.

The built-in scheduler starts when `ENABLE_BUILTIN_SCHEDULER=true` and the server is running (`npm run dev` or `npm start`).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — summary, next run, recent measurements |
| `/setup` | Locations, commutes, per-pair schedules |
| `/measurements` | History charts and full log |
| `/measurements/[id]` | Route map snapshot + recent times for that pair |

Legacy URLs `/pairs` and `/schedule` redirect to `/setup`.

## Automatic runs (local PC)

With these lines in `.env`:

```
ENABLE_BUILTIN_SCHEDULER=true
SCHEDULER_INTERVAL_MINUTES=5
```

the server checks for matching schedule slots every 5 minutes, aligned to the clock in `DEFAULT_TIMEZONE`. Checks also run once immediately on startup to catch the current window.

You should see **Built-in scheduler on** on the dashboard. Successful runs log `[scheduler]` in the server terminal.

To disable automatic runs, set `ENABLE_BUILTIN_SCHEDULER=false`.

## Manual test run

Click **Run morning** or **Run evening** on the dashboard (runs all active pairs in that direction now).

Or via curl:

```bash
curl -X POST "http://localhost:3000/api/run-now?period=morning"
curl -X POST "http://localhost:3000/api/run-now?period=afternoon"
```

The API parameter is `afternoon` (evening commute / work→home).

## Scheduled production runs

Point a cron service (Render cron, GitHub Actions, cron-job.org, etc.) at:

```
POST https://your-app.example.com/api/cron/run
Authorization: Bearer YOUR_CRON_SECRET
```

Run **every 5 minutes** so each slot is caught within the tolerance window after its scheduled time.

## Google Cloud setup

1. Create a project and enable billing
2. Enable **Routes API**
3. Create an API key and add **Routes API** to the key's allowed APIs (if using API restrictions)
4. Restrict the key appropriately (IP for server cron; unrestricted only for local dev)

Each measurement stores an encoded route polyline and traffic intervals. History detail pages render that snapshot with Leaflet/OpenStreetMap — no routing API call when viewing past routes.

## API usage estimate

Example with seed data (2 homes, 4 pairs):

- 2 morning pairs × 7 slots + 2 evening pairs × 9 slots = **32 Routes API calls/day**
- ~22 weekdays ≈ **700 calls/month**

Scale linearly with homes and active slots. Typical usage stays within Google's Routes API free tier for personal use.

## Deploy on GCP (always-on, free tier)

See **[deploy/gce/README.md](deploy/gce/README.md)** for step-by-step instructions: e2-micro VM, HTTPS, site password, and optional data migration from your PC.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply Prisma schema to SQLite |
| `npm run db:seed` | Reset and seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## v2 ideas

- Threshold alerts when drive time spikes
- Email or push notifications
