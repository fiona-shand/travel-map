import { geoBounds, geoContains, geoDistance } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, Geometry, Position } from 'geojson'
import type { Topology } from 'topojson-specification'

export type NamedFeature = Feature<Geometry, { name: string }>

/** ISO 3166-1 numeric for the United States. */
export const USA = '840'

/**
 * A shadeable shape on the globe.
 *
 * Every country is one region, except the United States, which is represented
 * by its 56 states and territories instead of a single blob - visiting one
 * state should not shade the entire country. `countryId` is what the country
 * count and flag lookups use, so a state still rolls up to the USA.
 */
export type Region = {
  id: string
  name: string
  countryId: string
  countryName: string
  feature: NamedFeature
}

const EARTH_RADIUS_KM = 6371

/**
 * How far off a generalized coastline we still accept a photo as "inside".
 *
 * Coastlines are simplified, so genuinely on-land points can fall just outside
 * the polygon: measured 3.2km for Manhattan, 3.4km for Miami Beach, 1.3km for
 * Amalfi. 200km covers that comfortably while leaving open ocean unresolved.
 */
export const NEAREST_TOLERANCE_KM = 200

export type LocateResult = {
  regionId: string
  regionName: string
  countryId: string
  countryName: string
  /** 'contains' = inside the polygon; 'nearest' = matched via coastline tolerance. */
  method: 'contains' | 'nearest'
  distanceKm: number
}

/**
 * A stable key for a country, used as a primary key in IndexedDB.
 *
 * 236 of the 241 country shapes carry an ISO 3166-1 numeric id. The five that
 * don't are disputed territories (Somaliland, Kosovo, N. Cyprus, Indian Ocean
 * Ter., Siachen Glacier); we slug those so they can still be visited and shaded.
 *
 * Ids are deliberately not unique per *shape*: Australia and its Ashmore and
 * Cartier Islands territory share ISO 036 and shade as one country.
 */
export function canonicalId(raw: unknown, name: string): string {
  if (raw !== undefined && raw !== null && String(raw).length > 0) {
    return String(raw).padStart(3, '0')
  }
  return `x-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

type VertexIndex = { region: Region; vertices: Position[] }[]

export class WorldAtlas {
  /** Every shadeable shape: countries, with the USA expanded into states. */
  readonly regions: Region[]
  private byIdIndex: Map<string, Region[]>
  private index: VertexIndex | null = null
  private boundsIndex: [[number, number], [number, number]][] | null = null

  constructor(countryTopo: Topology, stateTopo: Topology) {
    const countries = feature(
      countryTopo,
      countryTopo.objects.countries,
    ) as unknown as { features: NamedFeature[] }

    const states = feature(stateTopo, stateTopo.objects.states) as unknown as {
      features: NamedFeature[]
    }

    const regions: Region[] = []

    for (const f of countries.features) {
      const id = canonicalId((f as { id?: unknown }).id, f.properties.name)
      if (id === USA) continue // replaced by its states, below
      regions.push({
        id,
        name: f.properties.name,
        countryId: id,
        countryName: f.properties.name,
        feature: f,
      })
    }

    for (const f of states.features) {
      const fips = String((f as { id?: unknown }).id ?? '').padStart(2, '0')
      regions.push({
        id: `us-${fips}`,
        name: f.properties.name,
        countryId: USA,
        countryName: 'United States',
        feature: f,
      })
    }

    this.regions = regions
    this.byIdIndex = new Map()
    for (const region of regions) {
      const bucket = this.byIdIndex.get(region.id)
      if (bucket) bucket.push(region)
      else this.byIdIndex.set(region.id, [region])
    }
  }

  /** All shapes sharing an id (Australia + Ashmore both answer to '036'). */
  shapesFor(regionId: string): Region[] {
    return this.byIdIndex.get(regionId) ?? []
  }

  byId(regionId: string): Region | undefined {
    return this.byIdIndex.get(regionId)?.[0]
  }

  nameOf(regionId: string): string {
    return this.byId(regionId)?.name ?? 'Unknown'
  }

  countryIdOf(regionId: string): string {
    return this.byId(regionId)?.countryId ?? regionId
  }

  /**
   * Lat/lon bounding box per region, computed once.
   *
   * geoContains is far too slow to run against all 296 regions on every hover
   * frame. Nearly every region can be rejected by a cheap box test first, which
   * is what makes hover feel instant.
   */
  private bounds(): [[number, number], [number, number]][] {
    if (!this.boundsIndex) {
      this.boundsIndex = this.regions.map((r) => geoBounds(r.feature))
    }
    return this.boundsIndex
  }

  /**
   * Strict containment - no coastline tolerance.
   *
   * Used for globe hit-testing, where clicking open ocean should clear the
   * selection rather than snap to land 190km away. Also skips the
   * nearest-vertex scan, which would make hover unusable.
   */
  regionAt(lon: number, lat: number): Region | null {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    const point: [number, number] = [lon, lat]
    const boxes = this.bounds()

    for (let i = 0; i < this.regions.length; i++) {
      const [[minLon, minLat], [maxLon, maxLat]] = boxes[i]
      if (lat < minLat || lat > maxLat) continue
      // A box with minLon > maxLon straddles the antimeridian; accept it and
      // let geoContains decide rather than reasoning about the wrap here.
      if (minLon <= maxLon && (lon < minLon || lon > maxLon)) continue
      if (geoContains(this.regions[i].feature, point)) return this.regions[i]
    }
    return null
  }

  /** Flattened coordinate list per region, built once (~100k vertices, ~5ms). */
  private vertexIndex(): VertexIndex {
    if (this.index) return this.index
    this.index = this.regions.map((region) => {
      const vertices: Position[] = []
      const walk = (node: unknown): void => {
        if (Array.isArray(node) && typeof node[0] === 'number') {
          vertices.push(node as Position)
        } else if (Array.isArray(node)) {
          for (const child of node) walk(child)
        }
      }
      walk((region.feature.geometry as { coordinates?: unknown }).coordinates)
      return { region, vertices }
    })
    return this.index
  }

  /**
   * Resolve a photo's GPS coordinate to a region.
   *
   * Two stages, because point-in-polygon alone silently loses coastal photos:
   * plain containment finds no match for New York City or Miami against a
   * generalized coastline. Stage two rescues those by distance, while a
   * mid-ocean point (1300km from land) still correctly returns null.
   */
  locate(lon: number, lat: number, toleranceKm = NEAREST_TOLERANCE_KM): LocateResult | null {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null

    const hit = this.regionAt(lon, lat)
    if (hit) {
      return {
        regionId: hit.id,
        regionName: this.nameOf(hit.id),
        countryId: hit.countryId,
        countryName: hit.countryName,
        method: 'contains',
        distanceKm: 0,
      }
    }

    const point: [number, number] = [lon, lat]
    let best: Region | null = null
    let bestRadians = Infinity
    for (const { region, vertices } of this.vertexIndex()) {
      for (const v of vertices) {
        const d = geoDistance(point, v as [number, number])
        if (d < bestRadians) {
          bestRadians = d
          best = region
        }
      }
    }

    if (!best) return null
    const distanceKm = bestRadians * EARTH_RADIUS_KM
    if (distanceKm > toleranceKm) return null

    return {
      regionId: best.id,
      regionName: this.nameOf(best.id),
      countryId: best.countryId,
      countryName: best.countryName,
      method: 'nearest',
      distanceKm,
    }
  }
}

let atlasPromise: Promise<WorldAtlas> | null = null

async function fetchTopology(url: string): Promise<Topology> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.json()
}

/** Loads and caches the atlas. Shared by the UI and the import worker. */
export function loadAtlas(): Promise<WorldAtlas> {
  if (!atlasPromise) {
    atlasPromise = Promise.all([
      fetchTopology('/countries-50m.json'),
      fetchTopology('/states-10m.json'),
    ])
      .then(([countries, states]) => new WorldAtlas(countries, states))
      .catch((err) => {
        atlasPromise = null
        throw err
      })
  }
  return atlasPromise
}
