# Travel Pin

A globe of everywhere you've been. Drop in your photos, and each one is placed by
the GPS coordinates stored in its metadata — shading in the country (or US state)
it was taken in, and gathering itself into that place's page of memories.

Everything stays on your machine. Photos are held in IndexedDB and never uploaded;
there is no backend, no account, and no API key.

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

**Anything unplaceable is kept, not dropped.** Screenshots and social-media
downloads routinely have GPS stripped, so those land in an unplaced tray where you
assign them by clicking the globe.

**HEIC needs splitting in two.** `exifr` reads GPS straight out of an iPhone HEIC,
but browsers can't render one, so display goes through a lazily-imported
libheif-wasm converter that JPEG-only imports never pay for.

## Data

| Source | Why |
| --- | --- |
| `world-atlas` `countries-50m` | The 110m set omits Singapore, Hong Kong, Malta, the Maldives, Monaco, Barbados and Mauritius |
| `us-atlas` `states-10m` | Geographic (not Albers-projected) US state outlines |

Both are served from `public/` so they stay out of the JS bundle.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · d3-geo (orthographic, canvas-rendered)
· Dexie/IndexedDB · Zustand · exifr
