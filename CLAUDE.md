# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small weather app: a vanilla HTML/CSS/JS frontend (`public/`) talking to an Express backend (`server.js`) that proxies three external weather/climate APIs. No build step, no frontend framework, no test suite.

## Running locally

```bash
npm install
node server.js          # serves http://localhost:3000 — UI + API together
```

There is no watch/dev-reload script — restart `node server.js` manually after backend changes. `server.js` requires `OPENWEATHER_API_KEY` in a local `.env` file (gitignored); without it, `/api/weather` and `/api/forecast` will fail.

**Important**: `server.js` hardcodes `PORT = 3000` and does not read `process.env.PORT`. If you start a new instance while one is already running, kill the old one first (`lsof -ti:3000 -sTCP:LISTEN | xargs kill`) rather than letting the new one silently fail to bind.

There are no lint or test commands configured (`npm test` is a stub that exits with an error).

## Architecture

**Two deployments of the same code, serving different purposes:**
- **Render** (`server.js`, Node/Express) — hosts the API routes *and* serves `public/` via `express.static`, so the Render URL alone is a fully working fallback copy of the app.
- **Vercel** (`vercel.json`, `outputDirectory: "public"`) — serves `public/` as a static site only; it has no backend of its own and calls the Render API cross-origin. This is the primary deployment for mobile/PWA use.

Because of this split, `public/script.js` must pick its API base URL at runtime rather than hardcoding one:
```js
const sameOriginAsBackend = ["localhost", "127.0.0.1", ""].includes(window.location.hostname)
  || window.location.hostname.endsWith(".onrender.com");
const API_BASE = sameOriginAsBackend ? "" : RENDER_API;
```
Relative paths are used whenever the frontend and backend share an origin (local dev or Render); the full Render URL is used from anywhere else (Vercel, custom domains). **When changing the Render backend URL, update `RENDER_API` in `public/script.js` to match.**

**Backend (`server.js`) is a thin proxy, not a data layer.** All three routes just fetch an external API and forward the JSON; grouping/aggregation happens client-side in `public/script.js`:
- `/api/weather` and `/api/forecast` — proxy OpenWeatherMap (`appid=OPENWEATHER_API_KEY`), current conditions and a 5-day/3-hour-step forecast respectively.
- `/api/climate` — proxies Open-Meteo (no key required): geocodes the city name, then pulls 5 years of daily history (temp max/min, precipitation) from the archive API. Results are cached in-memory per city (`climateCache`, 24h TTL) since this is the slowest call (~1-2s cold, geocode + archive round trip).

**Why climate is a separate, independent fetch from weather/forecast**: `public/script.js`'s `getWeather()` only calls `loadClimate(city)` *after* the weather+forecast `Promise.all` succeeds, and `loadClimate` has its own try/catch that just hides the climate section on failure — it never calls `showError`. A flaky Open-Meteo response should never take down the core weather view.

**Client-side data transforms worth knowing before touching the UI:**
- `groupForecastByDay` — OpenWeatherMap's forecast is 3-hour buckets; this collapses them into 5 daily min/max cards, using the entry closest to `12:00:00` for the representative icon/description.
- `groupClimateByMonth` — bucket's Open-Meteo's daily history by calendar month (ignoring year) to compute avg high/low and rain-day percentage for the next 3 calendar months.
- `displayHourly` just takes `list.slice(0, 2)` from the forecast response (i.e. the next two 3-hour buckets) — there is no true hourly data source; see below.

**Race-condition guard for climate requests**: `loadClimate` uses a monotonic `climateRequestId` counter. Searching a new city increments it; a resolving fetch checks `requestId !== climateRequestId` and bails if a newer search has since started. This also gets incremented in `showError`. If you add another async per-search fetch, follow the same pattern — don't let a slow, stale response overwrite what a newer search already rendered.

**Service worker (`public/sw.js`) is network-first, not cache-first.** It was originally cache-first for the app shell, which caused returning users' browsers to serve an indefinitely stale `index.html`/`script.js` even after new deploys (the SW script itself hadn't changed, so no update was ever detected). It now always hits the network first and only falls back to the cache when offline. **If you ever need to change the caching strategy again, bump `CACHE_NAME`** — the `activate` handler deletes any cache key that doesn't match the current name, which is what actually clears stale caches for existing users.

**No real hourly or 90-day forecast exists.** OpenWeatherMap's free tier tops out at 3-hour steps for 5 days; true hourly data needs their paid One Call API 3.0 (billing-gated), and no service can forecast exact weather 3 months out. The "Climate Outlook" section is historical averages (Open-Meteo), not a forecast — keep that framing (labelled "avg of past 5 years" in the UI) if you extend it further out.

## External services and their constraints

- **OpenWeatherMap** (`OPENWEATHER_API_KEY` env var) — current + 5-day forecast only on the free tier.
- **Open-Meteo** (`geocoding-api.open-meteo.com`, `archive-api.open-meteo.com`) — free, no key, no account. Rate limits: 600/min, 5,000/hour, 10,000/day for non-commercial use. Each city search costs 2 calls (geocode + archive) unless served from `climateCache`.
- Weather icon images are loaded directly from `https://openweathermap.org/img/wn/{icon}@2x.png` — their default coloring (e.g. the "scattered clouds" icon) is near-invisible on the app's light card background, which is why `.forecast-day img` / `.hourly-slot img` give icons a tinted circular background in `public/style.css`. Keep that if you add more icon-bearing cards.

## PWA / deployment details

- `public/manifest.json` + `public/icons/` + the viewport meta tag in `public/index.html` are what make the app installable; `public/manifest.json`'s icon paths and `public/sw.js`'s `APP_SHELL` list need to stay in sync with whatever static files exist in `public/`.
- `vercel.json`'s `outputDirectory` must stay `"public"` — without it, Vercel's zero-config detection sees `express` in `package.json` and may try to treat the repo as a Node/serverless project instead of serving static files.
