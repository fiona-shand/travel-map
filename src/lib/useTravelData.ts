import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Place } from './db'

export type TravelData = {
  places: Map<string, Place>
  photoCounts: Map<string, number>
  /** Distinct countries, so fifty US states still count as one country. */
  visitedCountries: Set<string>
  visitedCount: number
  visitedRegionCount: number
  wishlistCount: number
  photoCount: number
  unplacedCount: number
  loading: boolean
}

const EMPTY: TravelData = {
  places: new Map(),
  photoCounts: new Map(),
  visitedCountries: new Set(),
  visitedCount: 0,
  visitedRegionCount: 0,
  wishlistCount: 0,
  photoCount: 0,
  unplacedCount: 0,
  loading: true,
}

/** Live view of everything the globe needs. Re-runs on any write. */
export function useTravelData(): TravelData {
  const data = useLiveQuery(async () => {
    const [placeRows, photoRows] = await Promise.all([
      db.places.toArray(),
      db.photos.toArray(),
    ])

    const places = new Map(placeRows.map((p) => [p.regionId, p]))
    const photoCounts = new Map<string, number>()
    const visitedCountries = new Set<string>()
    let unplacedCount = 0

    for (const photo of photoRows) {
      if (!photo.regionId) {
        unplacedCount++
        continue
      }
      photoCounts.set(photo.regionId, (photoCounts.get(photo.regionId) ?? 0) + 1)
    }

    let visitedRegionCount = 0
    let wishlistCount = 0
    for (const place of placeRows) {
      if (place.status === 'visited') {
        visitedRegionCount++
        visitedCountries.add(place.countryId)
      } else {
        wishlistCount++
      }
    }

    return {
      places,
      photoCounts,
      visitedCountries,
      visitedCount: visitedCountries.size,
      visitedRegionCount,
      wishlistCount,
      photoCount: photoRows.length,
      unplacedCount,
      loading: false,
    }
  }, [])

  return data ?? EMPTY
}

export function useRegionPhotos(regionId: string | null) {
  return useLiveQuery(
    async () => {
      if (!regionId) return []
      const rows = await db.photos.where('regionId').equals(regionId).toArray()
      return rows.sort((a, b) => (b.takenAt ?? b.createdAt) - (a.takenAt ?? a.createdAt))
    },
    [regionId],
    [],
  )
}

export function useUnplacedPhotos() {
  return useLiveQuery(async () => (await db.photos.toArray()).filter((p) => !p.regionId), [], [])
}

export function useAllPhotos() {
  return useLiveQuery(
    async () => {
      const rows = await db.photos.toArray()
      return rows.sort((a, b) => (b.takenAt ?? b.createdAt) - (a.takenAt ?? a.createdAt))
    },
    [],
    [],
  )
}

/** Cities added under one region. */
export function useRegionCities(regionId: string | null) {
  return useLiveQuery(
    async () => {
      if (!regionId) return []
      return db.cities.where('regionId').equals(regionId).toArray()
    },
    [regionId],
    [],
  )
}

export function useTrips() {
  return useLiveQuery(async () => db.trips.orderBy('createdAt').reverse().toArray(), [], [])
}
