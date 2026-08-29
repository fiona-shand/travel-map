import { geoContains, geoDistance } from 'd3-geo'
import { metaFor } from './countryMeta'
import type { Region } from './geo'

export type CityOption = {
  name: string
  lat: number
  lon: number
  population: number
}

/** Raw file shape: [name, lat, lon, population], population-sorted. */
type CityTuple = [string, number, number, number]

const EARTH_RADIUS_KM = 6371

/**
 * How close a photo has to be to count as taken in a city. Generous enough to
 * cover a metro area and its airport, tight enough that neighbouring towns
 * don't swallow each other.
 */
export const CITY_RADIUS_KM = 25

export function distanceKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  return geoDistance([aLon, aLat], [bLon, bLat]) * EARTH_RADIUS_KM
}

const cache = new Map<string, Promise<CityOption[]>>()

/** Cities for one country, fetched once and cached. */
function loadCountryCities(alpha2: string): Promise<CityOption[]> {
  const hit = cache.get(alpha2)
  if (hit) return hit

  const promise = fetch(`/cities/${alpha2}.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: CityTuple[]) =>
      rows.map(([name, lat, lon, population]) => ({ name, lat, lon, population })),
    )
    .catch(() => [])

  cache.set(alpha2, promise)
  return promise
}

const regionCache = new Map<string, Promise<CityOption[]>>()

/**
 * Cities inside a region.
 *
 * City data is published per country, so for a subdivision like a US state we
 * narrow the country's list to those actually within the state's outline. The
 * bounding-box check first keeps that cheap - the US file alone holds 16,000
 * places.
 */
export function citiesForRegion(region: Region): Promise<CityOption[]> {
  const hit = regionCache.get(region.id)
  if (hit) return hit

  const alpha2 = metaFor(region.countryId).alpha2
  if (!alpha2) return Promise.resolve([])

  const isSubdivision = region.countryId !== region.id
  const promise = loadCountryCities(alpha2).then((all) => {
    if (!isSubdivision) return all

    const coords = (region.feature.geometry as { coordinates?: unknown }).coordinates
    let minLon = 180
    let maxLon = -180
    let minLat = 90
    let maxLat = -90
    const walk = (node: unknown): void => {
      if (Array.isArray(node) && typeof node[0] === 'number') {
        const [lon, lat] = node as [number, number]
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      } else if (Array.isArray(node)) {
        for (const child of node) walk(child)
      }
    }
    walk(coords)

    return all.filter(
      (c) =>
        c.lon >= minLon &&
        c.lon <= maxLon &&
        c.lat >= minLat &&
        c.lat <= maxLat &&
        geoContains(region.feature, [c.lon, c.lat]),
    )
  })

  regionCache.set(region.id, promise)
  return promise
}

/** Name search for the add-city typeahead, most populous first. */
export function searchCities(cities: CityOption[], query: string, limit = 12): CityOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return cities.slice(0, limit)

  const starts: CityOption[] = []
  const contains: CityOption[] = []
  for (const city of cities) {
    const name = city.name.toLowerCase()
    if (name.startsWith(q)) starts.push(city)
    else if (name.includes(q)) contains.push(city)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}
