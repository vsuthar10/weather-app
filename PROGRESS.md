# Progress Log

A running record of what's been built, deployed, and fixed on this weather app, so the history doesn't have to be re-derived from `git log` every time.

## Current status (as of 2026-10-05)

Live in two places:
- **Render** — `https://weather-app-backend-iye5.onrender.com` — Express API + serves the full UI as a fallback (`express.static`). Free tier: spins down after inactivity, first request after idle can take ~50s.
- **Vercel** — `https://weather-app-one-iota-14.vercel.app` — static frontend only (`public/`), calls the Render API cross-origin. This is the primary installable PWA entry point for mobile.

Both auto-deploy from `main` on push.

## Features built

1. **Core weather lookup** (initial commit) — search a city, see current conditions (temp, feels-like, humidity, wind, pressure) via OpenWeatherMap, with a Node/Express proxy backend so the API key stays server-side.
2. **5-day forecast** (`766f007`) — `/api/forecast` proxy + client-side grouping of OpenWeatherMap's 3-hour buckets into 5 daily min/max cards.
3. **Environment-aware API base URL** (`80eca37`, later generalized in `91a1e65`/`0813c06`) — `public/script.js` picks relative vs. absolute Render URL at runtime depending on `window.location.hostname`, to support the frontend being served from different origins (local, Render, Vercel) at different points.
4. **Combined frontend+backend on Render** (`626b0a6`) — moved `index.html`/`script.js`/`style.css` into `public/`, had `server.js` serve them via `express.static`, so one Render URL works end-to-end.
5. **Upcoming hours + live city clock** (`91a1e65`) — next two ~3-hour forecast slots (no true hourly data source exists on the free tier), and a live-ticking local time for the searched city using the `timezone` offset already in the weather response.
6. **PWA support** (`0813c06`, config fix in `2dd50ed`) — manifest, icons, service worker, viewport meta tag, and `vercel.json` so the static frontend could be deployed separately on Vercel and installed to a phone home screen.
7. **3-month Climate Outlook** (`fcb48d3`) — since no service can forecast exact weather months ahead, this shows historical averages instead: avg high/low temp and rain-day % per month, computed from 5 years of Open-Meteo archive data (free, no API key). Explicitly labeled "avg of past 5 years" to avoid being mistaken for a forecast.

## Bugs found and fixed

- **Service worker serving stale content forever** (`c1f132e`) — the original cache-first strategy meant returning users' browsers kept serving whatever `index.html`/`script.js` was first cached, regardless of new deploys, since the SW script itself never changed and so never re-triggered an update check. Fixed by switching to network-first with cache-as-offline-fallback, and bumping `CACHE_NAME` to flush the old cache. Confirmed via testing that future deploys now show up on the very next reload.
- **Climate outlook latency + race condition** (`093c28b`) — cold climate lookups took ~1.7s (geocode + 5-year archive call); added a 24h in-memory cache per city (repeat lookups now ~2ms). Also fixed a real race: searching a new city before a previous city's climate fetch resolved had no guard, so a slower, stale response could land after and silently overwrite or hide the correct data. Fixed with a monotonic request-id guard in `loadClimate`.
- **`vercel.json` invalid `buildCommand`** (`2dd50ed`) — used `false` instead of a string/`null`, which could fail Vercel's schema validation.

## Known constraints (not bugs, just real limits)

- OpenWeatherMap's free tier caps forecast data at 5 days / 3-hour steps — true hourly data or >5-day forecasts require their paid One Call API 3.0.
- No weather service can forecast exact daily conditions 3 months out — the Climate Outlook is historical averages, by design, not a forecast.
- Open-Meteo's free, keyless tier is rate-limited to 600/min, 5,000/hour, 10,000/day — fine for this app's scale, but worth knowing if usage ever grows.

See `CLAUDE.md` for the architectural reasoning behind these decisions in more depth.
