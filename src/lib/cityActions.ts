import { CITY_RADIUS_KM, distanceKm, type CityOption } from './cities'
import { db, newId, type City, type Photo } from './db'

/** Nearest city to a coordinate, or null if none is close enough. */
export function nearestCity(
  cities: City[],
  lon: number,
  lat: number,
  radiusKm = CITY_RADIUS_KM,
): City | null {
  let best: City | null = null
  let bestKm = Infinity
  for (const city of cities) {
    const km = distanceKm(lon, lat, city.lon, city.lat)
    if (km < bestKm) {
      bestKm = km
      best = city
    }
  }
  return best && bestKm <= radiusKm ? best : null
}

/**
 * Add a city under a region, then sweep that region's existing photos into it.
 *
 * Adding a city after importing is the normal order of events, so the sweep is
 * what makes it feel automatic - otherwise a newly added city would sit at zero
 * despite the photos already being there.
 */
export async function addCity(
  regionId: string,
  countryId: string,
  option: CityOption,
): Promise<City> {
  const city: City = {
    id: newId(),
    regionId,
    countryId,
    name: option.name,
    lat: option.lat,
    lon: option.lon,
    createdAt: Date.now(),
  }

  await db.transaction('rw', db.cities, db.photos, async () => {
    await db.cities.add(city)

    const photos = await db.photos.where('regionId').equals(regionId).toArray()
    for (const photo of photos) {
      if (photo.cityId || photo.lat === null || photo.lon === null) continue
      if (distanceKm(photo.lon, photo.lat, city.lon, city.lat) <= CITY_RADIUS_KM) {
        await db.photos.update(photo.id, { cityId: city.id })
      }
    }
  })

  return city
}

/** Remove a city, releasing its photos back to the country. */
export async function removeCity(cityId: string): Promise<void> {
  await db.transaction('rw', db.cities, db.photos, async () => {
    await db.cities.delete(cityId)
    const photos = await db.photos.where('cityId').equals(cityId).toArray()
    for (const photo of photos) {
      await db.photos.update(photo.id, { cityId: null })
    }
  })
}

/** File a freshly imported photo under one of its region's cities, if any. */
export async function cityForPhoto(
  photo: Pick<Photo, 'regionId' | 'lat' | 'lon'>,
): Promise<string | null> {
  if (!photo.regionId || photo.lat === null || photo.lon === null) return null
  const cities = await db.cities.where('regionId').equals(photo.regionId).toArray()
  if (cities.length === 0) return null
  return nearestCity(cities, photo.lon, photo.lat)?.id ?? null
}
