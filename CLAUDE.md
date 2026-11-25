# CLAUDE.md – Unplastic the Plastic (repo: zero-plastic)

## Goal
Free website for "Unplastic the Plastic" (#unplastictheplastic), a student social
campaign in Surabaya, Indonesia. After the visitor allows location access, it picks
the nearest / best-matching plastic waste drop-off point (bank sampah, TPS3R, pusat
daur ulang, drop box) in Kota Surabaya from `data/lokasi.json` and links to Google
Maps directions.

## Hard constraints
- Static site only, hosted on GitHub Pages (served under the `/zero-plastic/` subpath).
  No server, no backend, no build step.
- No paid APIs and no API keys in the code (the repo is public).
- Map: Leaflet loaded from a CDN (unpkg, pinned version with SRI `integrity`; update
  the hash if the version changes). Basemaps in `GAYA_PETA` (app.js) must work without
  an API key: OSM standard (default) and Esri Canvas light/dark + World Imagery.
  CARTO basemaps now return "API KEY REQUIRED" – don't use them. Google Maps tiles
  need a key/billing – only link out to Google Maps, never embed it.
- Fonts: Fraunces (serif display) + Plus Jakarta Sans via Google Fonts, with system fallbacks.
- Design: clean and elegant (deep green gradient, gold accent, ivory background,
  SVG line icons). Avoid emoji in the UI and avoid adding non-essential sections.
- All UI text in Bahasa Indonesia. Mobile-first: most visitors come from Instagram on phones.
  Must work at ~375px width with no horizontal scroll.
- Plain HTML/CSS/JS, no framework. Keep it easy for non-developers to maintain.
- All paths relative (`style.css`, `app.js`, `data/lokasi.json`). Never use leading `/`.
- Visitor location is processed only in the browser: never stored, logged or sent anywhere.

## File structure
```
index.html          Page markup, loads Leaflet from CDN, style.css, app.js
style.css           All styles (theme colors as CSS variables in :root)
app.js              Pure logic at top (jarakKm, urutkanLokasi, ...), DOM code below.
                    DOM init is guarded by `typeof document` so the logic can be
                    loaded in Node for tests.
data/lokasi.json    Location data (array)
README.md           Maintainer guide in Bahasa Indonesia
.nojekyll           Serve files as-is on GitHub Pages
```

## Data schema (`data/lokasi.json`)
Array of objects:

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | unique |
| `nama` | string | yes | |
| `lat` | number | yes | -90..90 (Surabaya ≈ -7.x) |
| `lng` | number | yes | -180..180 (Surabaya ≈ 112.x) |
| `alamat` | string | yes | |
| `jenis` | string | yes | e.g. "bank sampah", "TPS3R", "pengepul" |
| `plastik_diterima` | string[] | yes | e.g. ["PET","HDPE","PP","kresek","sachet","styrofoam"]; matched case-insensitively; display labels in `LABEL_PLASTIK` in app.js |
| `jam_buka` | string | yes | free text |
| `kontak` | string | no | only with the owner's consent |
| `tujuan_gmaps` | string | no | text Google Maps searches for directions (use when lat/lng is approximate) |
| `sumber` | string[] | required if unverified | source URLs for the info |
| `terverifikasi` | boolean | yes | |

Entries with invalid `nama`/`lat`/`lng` are skipped by app.js (console warning).

## Data honesty rule
- Locations must be real places in Kota Surabaya. Never invent places, phone numbers
  or social handles.
- Researched-but-unchecked entries keep `terverifikasi: false` (shown as "Belum dicek")
  and must list `sumber`. Never flip `terverifikasi` to `true` unless the maintainers
  confirm they checked the place.
- If coordinates are approximate, set `tujuan_gmaps` so directions resolve to the
  real place, and say so in the README's "Daftar lokasi yang perlu dicek" table.
- Don't claim accepted plastic types or opening hours beyond what sources say;
  use "Belum ada info" when unknown.

## Behaviour notes
- Ranking: optional plastic filter first, then haversine (straight-line) distance; top 3 shown.
- Nearest result > 25 km (`PENGATURAN.batasJauhKm`) → honest warning + Google Maps
  "bank sampah" search fallback. Same fallback when a filter yields no results.
- Geolocation denied/unavailable → map centred on Surabaya; tapping the map sets the position.
- Directions link: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`, or
  `destination=<tujuan_gmaps>` when that field is set (new tab).
- Map style choice is remembered per visitor in localStorage (wrapped in try/catch).
- Render data via `textContent` / DOM nodes, never `innerHTML` with data values.

## Out of scope (for now)
Public location submissions (planned: Google Form → Sheet → manual JSON update). Don't build it.

## Checking changes
- `data/lokasi.json` must parse; every entry needs valid lat/lng.
- Test locally with `python3 -m http.server` (fetch doesn't work from `file://`).
