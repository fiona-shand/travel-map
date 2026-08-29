/**
 * Generates the per-country city files the "Add city" typeahead reads.
 *
 * One file per country rather than a single index: a country page only ever
 * needs its own cities, and the whole set is ~4MB. The output is generated
 * rather than committed, so `all-the-cities` (a 6MB dev dependency) never
 * reaches the browser.
 *
 * Format is [name, lat, lon, population], sorted by population descending, so
 * the typeahead can show the most likely match first without re-sorting.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import cities from 'all-the-cities'

const MIN_POPULATION = 1000
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'cities')

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const byCountry = new Map()
for (const city of cities) {
  if (city.population < MIN_POPULATION) continue
  const [lon, lat] = city.loc.coordinates
  const bucket = byCountry.get(city.country) ?? []
  bucket.push([city.name, +lat.toFixed(4), +lon.toFixed(4), city.population])
  byCountry.set(city.country, bucket)
}

let total = 0
for (const [country, list] of byCountry) {
  list.sort((a, b) => b[3] - a[3])
  const json = JSON.stringify(list)
  total += json.length
  writeFileSync(join(OUT_DIR, `${country}.json`), json)
}

writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify([...byCountry.keys()].sort()))

console.log(
  `cities: ${byCountry.size} countries, ` +
    `${[...byCountry.values()].reduce((n, l) => n + l.length, 0)} places, ` +
    `${Math.round(total / 1024)}KB`,
)
