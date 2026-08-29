import { db, markVisited } from './db'
import type { WorldAtlas } from './geo'

/**
 * Attach an unplaced photo to a region and shade it in.
 *
 * Kept out of the component file so React Fast Refresh stays happy - a module
 * that exports both components and plain functions can't be hot-swapped.
 */
export async function assignPhotoToRegion(
  photoId: string,
  regionId: string,
  atlas: WorldAtlas,
): Promise<void> {
  const photo = await db.photos.get(photoId)
  const region = atlas.byId(regionId)
  if (!photo || !region) return

  await db.photos.update(photoId, {
    regionId,
    regionName: region.name,
    countryId: region.countryId,
    placedBy: 'manual',
  })
  await markVisited(regionId, region.countryId, photo.takenAt)
}
