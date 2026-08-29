# Travel Pin

A globe of everywhere you've been. Drop in your photos, and each one is placed by
the GPS coordinates stored in its metadata — shading in the country (or US state)
it was taken in, and gathering itself into that place's page of memories.

Everything stays on your machine. Photos are held in IndexedDB and never uploaded;
there is no backend, no account, and no API key.

**Live:** https://travel-map-five-smoky.vercel.app — your photos stay in your own
browser, so the deployed app starts empty for whoever opens it.

## Running it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Typecheck and production build |
| `npx vitest run` | Geo resolver tests |
| `npm run cities` | Regenerate `public/cities/` (also run by `dev` and `build`) |

## Deploying

Deployed on Vercel, linked to this repo, so pushes to `main` ship automatically.

`vercel.json` pins the build command to `npm run build` rather than letting the
Vite preset run `vite build` directly — the latter would skip city generation and
ship an app whose "Add city" search silently returns nothing.

## How it works

**Regions, not just countries.** Every country is one shadeable shape, except the
United States, which is split into its 56 states and territories — visiting
California shouldn't shade the whole country. A state still rolls up to the USA
for the country count.

**Placing a photo takes two stages.** Point-in-polygon alone silently loses
coastal photos: plain containment finds no match for New York City or Miami,
because generalized coastlines cut inside the real shoreline. So `WorldAtlas.locate`
first tries containment, then falls back to the nearest region within 200km.
Measured: NYC 3.2km, Miami 3.4km, Amalfi 1.3km — while a mid-Atlantic point stays
correctly unresolved at 1312km. `src/lib/__tests__/geo.test.ts` guards this; it's
the one place a silent regression would quietly lose photos.

**Cities are yours to add, then fill themselves.** A country page lets you add
the cities you visited, searched from that country's own list. Any photo within
25km of one is filed under it — including photos already imported, since adding
a city sweeps the country's existing photos so a new city never sits at zero.

**Some territories are split back out.** Natural Earth draws by sovereignty, so
Svalbard arrives as nine polygons inside Norway's geometry despite holding its
own ISO code (SJ). `SPLIT_OUT` in `geo.ts` separates it into a country of its
own — mainland Norway tops out at 71.18°N and Bear Island, Svalbard's
southernmost, sits at 74.35°N, so a cut at 73°N is unambiguous. Jan Mayen stays
with Norway; it isn't part of the archipelago. The "% of the world" denominator
is derived from the atlas rather than hardcoded, so it stays honest.

**Anything unplaceable is kept, not dropped.** Screenshots and social-media
downloads routinely have GPS stripped, so those land in an unplaced tray where you
assign them by clicking the globe.

**HEIC needs splitting in two, across two threads.** `exifr` reads GPS straight
out of an iPhone HEIC, but browsers can't render one, so display goes through a
lazily-imported libheif-wasm converter that JPEG-only imports never pay for.
That conversion **cannot run in a worker**: `heic-to` encodes via
`document.createElement('canvas')`, so it throws `ReferenceError: document is
not defined` there. So the main thread converts, and the worker does EXIF,
thumbnailing and the geo lookup — reading EXIF from the *original* file, since
GPS doesn't survive the conversion.

A HEIC that fails to convert is skipped rather than stored, because keeping the
original produces a photo that saves perfectly but is invisible everywhere in
the UI — indistinguishable from the import having done nothing.

## Data

| Source | Why |
| --- | --- |
| `world-atlas` `countries-50m` | The 110m set omits Singapore, Hong Kong, Malta, the Maldives, Monaco, Barbados and Mauritius |
| `us-atlas` `states-10m` | Geographic (not Albers-projected) US state outlines |
| `all-the-cities` | 112k places with population ≥ 1000, for the city typeahead |

The first two are served from `public/`, so they stay out of the JS bundle.

City data is **generated, not committed**: `npm run cities` (run automatically
before `dev` and `build`) writes one file per country into `public/cities/`.
One file per country because a country page only ever needs its own — the whole
set is ~4MB, but France is 316KB and Greece 34KB, fetched only when opened.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · d3-geo (orthographic, canvas-rendered)
· Dexie/IndexedDB · Zustand · exifr
