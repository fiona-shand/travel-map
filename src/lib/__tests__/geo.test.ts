import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { USA, WorldAtlas } from '../geo'

const load = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../public/${name}`, import.meta.url)), 'utf8'))

const atlas = new WorldAtlas(load('countries-50m.json'), load('states-10m.json'))

describe('WorldAtlas.locate', () => {
  // Small nations absent from the 110m dataset - the reason we ship 50m.
  it.each([
    ['Singapore', 103.8198, 1.3521, 'Singapore'],
    ['Paris', 2.3522, 48.8566, 'France'],
    ['Tokyo', 139.6917, 35.6895, 'Japan'],
    ['Santorini', 25.43, 36.39, 'Greece'],
    ['Maldives', 73.5, 4.2, 'Maldives'],
    ['Cape Town', 18.4241, -33.9249, 'South Africa'],
  ])('places %s inside the polygon', (_label, lon, lat, expected) => {
    const hit = atlas.locate(lon, lat)
    expect(hit?.regionName).toBe(expected)
    expect(hit?.method).toBe('contains')
  })

  // These fail plain point-in-polygon against the 50m coastline.
  it.each([
    ['Amalfi', 14.6026, 40.634, 'Italy'],
    ['Monaco', 7.4246, 43.7384, 'Monaco'],
  ])('rescues coastal %s via the nearest fallback', (_label, lon, lat, expected) => {
    const hit = atlas.locate(lon, lat)
    expect(hit?.regionName).toBe(expected)
    expect(hit?.method).toBe('nearest')
    expect(hit!.distanceKm).toBeLessThan(30)
  })

  it('leaves open ocean unresolved rather than guessing', () => {
    expect(atlas.locate(-40, 30)).toBeNull()
  })

  it('rejects out-of-range and non-finite coordinates', () => {
    expect(atlas.locate(999, 0)).toBeNull()
    expect(atlas.locate(0, 91)).toBeNull()
    expect(atlas.locate(Number.NaN, 10)).toBeNull()
  })

  it('reports one canonical name for countries sharing an ISO id', () => {
    // Australia and Ashmore and Cartier Is. are both ISO 036 and shade as one.
    const sydney = atlas.locate(151.2153, -33.8568)
    const ashmore = atlas.locate(123.05, -12.25)
    expect(sydney?.regionId).toBe('036')
    expect(ashmore?.regionId).toBe('036')
    expect(ashmore?.regionName).toBe(sydney?.regionName)
    expect(sydney?.regionName).toBe('Australia')
  })

  it('gives disputed territories without an ISO id a stable slug', () => {
    const kosovo = atlas.locate(21.1655, 42.6629)
    expect(kosovo?.regionId).toBe('x-kosovo')
  })
})

describe('Svalbard split out of Norway', () => {
  it('resolves Longyearbyen to Svalbard, not Norway', () => {
    const hit = atlas.locate(15.6469, 78.2232)
    expect(hit?.regionName).toBe('Svalbard')
    expect(hit?.countryId).toBe('744') // ISO 3166-1 for Svalbard and Jan Mayen
    expect(hit?.method).toBe('contains')
  })

  it('keeps mainland Norway intact', () => {
    const oslo = atlas.locate(10.7461, 59.9127)
    expect(oslo?.regionName).toBe('Norway')
    expect(oslo?.countryId).toBe('578')

    // North Cape, the northern tip of the mainland, must stay Norwegian.
    const nordkapp = atlas.locate(25.7833, 71.1667)
    expect(nordkapp?.countryId).toBe('578')
  })

  it('counts Svalbard as its own country', () => {
    const svalbard = atlas.regions.filter((r) => r.countryId === '744')
    expect(svalbard).toHaveLength(1)
    expect(atlas.nameOf('744')).toBe('Svalbard')
  })

  it('splits without losing or duplicating any of Norway’s polygons', () => {
    const count = (id: string) => {
      const g = atlas.byId(id)!.feature.geometry as { coordinates: unknown[] }
      return g.coordinates.length
    }
    // Norway arrives from the dataset as 32 polygons; 9 are Svalbard.
    expect(count('578') + count('744')).toBe(32)
    expect(count('744')).toBe(9)
  })
})

describe('United States regions', () => {
  // The higher-resolution state outlines resolve coastal cities directly,
  // where the 50m country outline needed the nearest fallback.
  it.each([
    ['New York City', -74.006, 40.7128, 'New York'],
    ['Miami', -80.19, 25.76, 'Florida'],
    ['Santa Monica pier', -118.4973, 34.0089, 'California'],
    ['Chicago', -87.63, 41.88, 'Illinois'],
    ['Honolulu', -157.86, 21.31, 'Hawaii'],
    ['Anchorage', -149.9, 61.22, 'Alaska'],
  ])('resolves %s to its state', (_label, lon, lat, expected) => {
    const hit = atlas.locate(lon, lat)
    expect(hit?.regionName).toBe(expected)
    expect(hit?.method).toBe('contains')
  })

  it('rolls states up to the USA for country counting', () => {
    const hit = atlas.locate(-74.006, 40.7128)
    expect(hit?.regionId).toBe('us-36')
    expect(hit?.countryId).toBe(USA)
    expect(hit?.countryName).toBe('United States')
  })

  it('replaces the single USA shape with states, so it is never shadeable as one', () => {
    expect(atlas.regions.some((r) => r.id === USA)).toBe(false)
    const states = atlas.regions.filter((r) => r.countryId === USA)
    expect(states).toHaveLength(56)
  })
})
