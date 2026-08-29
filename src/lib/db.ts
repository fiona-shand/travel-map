import Dexie, { type EntityTable } from 'dexie'

export type PlaceStatus = 'visited' | 'wishlist'

export type Photo = {
  id: string
  /** Display-ready blob. HEIC originals are converted to JPEG on import. */
  blob: Blob
  /** ~400px WebP used by every grid, so the UI never decodes full-size photos. */
  thumbBlob: Blob
  fileName: string
  takenAt: number | null
  lat: number | null
  lon: number | null
  /** null while the photo sits in the unplaced tray awaiting manual assignment. */
  regionId: string | null
  regionName: string | null
  /** Parent country, so US states still roll up to one country. */
  countryId: string | null
  /** How the region was determined - 'manual' means the user assigned it. */
  placedBy: 'contains' | 'nearest' | 'manual' | null
  caption: string
  createdAt: number
}

export type Place = {
  regionId: string
  countryId: string
  status: PlaceStatus
  firstVisit: number | null
  notes: string
  updatedAt: number
}

export type Trip = {
  id: string
  title: string
  regionIds: string[]
  startDate: string | null
  endDate: string | null
  notes: string
  createdAt: number
}

/**
 * The pre-release database keyed `places` by `countryId`. Splitting the USA
 * into states made `regionId` the primary key instead, and IndexedDB cannot
 * change a store's key path in place - Dexie refuses the upgrade and every
 * query then fails silently. That database only ever held seeded demo data, so
 * we start a clean one and drop the old.
 */
const LEGACY_DB = 'travel-pin'
if (typeof indexedDB !== 'undefined') {
  indexedDB.deleteDatabase(LEGACY_DB)
}

const db = new Dexie('travelpin') as Dexie & {
  photos: EntityTable<Photo, 'id'>
  places: EntityTable<Place, 'regionId'>
  trips: EntityTable<Trip, 'id'>
}

db.version(1).stores({
  photos: 'id, regionId, countryId, takenAt, createdAt',
  places: 'regionId, countryId, status',
  trips: 'id, createdAt',
})

export { db }

export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Mark a region visited, keeping the earliest known visit date.
 * Called on import and when a photo is placed by hand; also usable on its own
 * for places you've been to but have no photos of.
 */
export async function markVisited(
  regionId: string,
  countryId: string,
  when: number | null,
): Promise<void> {
  await db.transaction('rw', db.places, async () => {
    const existing = await db.places.get(regionId)
    const firstVisit =
      when === null
        ? (existing?.firstVisit ?? null)
        : Math.min(when, existing?.firstVisit ?? Number.POSITIVE_INFINITY)

    await db.places.put({
      regionId,
      countryId,
      status: 'visited',
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : null,
      notes: existing?.notes ?? '',
      updatedAt: Date.now(),
    })
  })
}

/** Toggle a wishlist region. Visited regions are never downgraded. */
export async function toggleWishlist(regionId: string, countryId: string): Promise<void> {
  await db.transaction('rw', db.places, async () => {
    const existing = await db.places.get(regionId)
    if (existing?.status === 'visited') return
    if (existing?.status === 'wishlist') {
      await db.places.delete(regionId)
      return
    }
    await db.places.put({
      regionId,
      countryId,
      status: 'wishlist',
      firstVisit: null,
      notes: '',
      updatedAt: Date.now(),
    })
  })
}

export async function clearPlace(regionId: string): Promise<void> {
  await db.places.delete(regionId)
}
