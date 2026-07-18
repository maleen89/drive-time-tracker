# Drive Time Tracker

Track Google Maps driving distance and duration between address pairs on a shared schedule. Built for comparing Bay Area commutes (e.g. neighborhood home buys vs. work).

## Features (v1)

- Manage origin → destination address pairs (both directions supported)
- Shared schedule slots — all active pairs run at the same times
- Automated measurements via built-in scheduler (local PC) or `/api/cron/run` (cloud)
- Dashboard, history charts, route snapshots, and CSV export

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

- `GOOGLE_MAPS_API_KEY` — from [Google Cloud Console](https://console.cloud.google.com/) with **Routes API** enabled
- `ENABLE_BUILTIN_SCHEDULER=true` — automatic runs while the server is on (local PC)
- `CRON_SECRET` — optional; only needed if an external service calls `/api/cron/run` (cloud deploy)

### 3. Database

```bash
npm run db:push
npx tsx prisma/seed.ts
```

Seed creates:

- **4 pairs** (Fremont & Dublin homes ↔ Work at 690 E Middlefield Ave, Mountain View)
- **16 slots** — every 30 min from 7:00–10:00 and 14:00–18:00, Mon–Fri, Pacific time

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Desktop shortcut (Windows)

Double-click **`Start Drive Time Tracker.bat`** in the project folder to:

1. Start the dev server (opens a terminal window if it is not already running)
2. Open the app in your browser

**Pin to desktop:** right-click `Start Drive Time Tracker.bat` → **Send to** → **Desktop (create shortcut)**. You can rename the shortcut and change its icon in the shortcut properties.

If the server is already running, double-clicking only opens the browser.

The built-in scheduler starts automatically when `ENABLE_BUILTIN_SCHEDULER=true` in `.env`.

### 5. Automatic runs on this PC

With these lines in `.env` (already enabled by default):

```
ENABLE_BUILTIN_SCHEDULER=true
SCHEDULER_INTERVAL_MINUTES=5
```

the server checks your schedule every 5 minutes while `npm run dev` is running. No external cron service or Task Scheduler required.

You should see `Built-in scheduler on` on the dashboard. Logs appear in the server terminal as `[scheduler]` when measurements are created.

To disable automatic runs, set `ENABLE_BUILTIN_SCHEDULER=false`.

### 6. Manual test run

Click **Run morning** or **Run evening** on the dashboard.

Or via curl:

```bash
curl -X POST "http://localhost:3000/api/run-now?period=morning"
curl -X POST "http://localhost:3000/api/run-now?period=afternoon"
```

## Scheduled production runs

Point a cron service (Render cron, GitHub Actions, cron-job.org, etc.) at:

```
POST https://your-app.example.com/api/cron/run
Authorization: Bearer YOUR_CRON_SECRET
```

Run **every 5 minutes** so each slot is caught within a few minutes after its scheduled time.

## Google Cloud setup

1. Create a project and enable billing
2. Enable **Routes API** (replaces Distance Matrix for scheduled measurements)
3. Create an API key
4. Restrict the key (IP for server cron, or unrestricted for local dev only)

Each scheduled measurement stores an encoded route polyline and traffic intervals in the database. History detail pages render that snapshot with Leaflet/OpenStreetMap — no extra routing API calls when viewing past routes.

## API usage estimate

4 pairs × 16 slots × ~22 weekdays ≈ **1,400 Routes API calls/month** — typically within Google's free tier for compute routes.

## v2 ideas

- Per-pair schedule overrides
- Threshold alerts
