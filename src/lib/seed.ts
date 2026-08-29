import { db, markVisited, newId } from './db'
import { USA } from './geo'

/**
 * Marks a spread of places visited so the globe can be judged visually before
 * any photos exist. Country ids are ISO numeric; US states are FIPS-based.
 */
const DEMO_VISITS: [regionId: string, countryId: string, year: number][] = [
  ['250', '250', 2019], // France
  ['380', '380', 2022], // Italy
  ['724', '724', 2023], // Spain
  ['620', '620', 2018], // Portugal
  ['300', '300', 2024], // Greece
  ['528', '528', 2021], // Netherlands
  ['392', '392', 2024], // Japan
  ['764', '764', 2023], // Thailand
  ['704', '704', 2023], // Vietnam
  ['710', '710', 2016], // South Africa
  ['484', '484', 2019], // Mexico
  ['352', '352', 2022], // Iceland
  ['191', '191', 2018], // Croatia
  ['702', '702', 2023], // Singapore
  ['us-36', USA, 2017], // New York
  ['us-06', USA, 2018], // California
  ['us-12', USA, 2015], // Florida
  ['us-15', USA, 2022], // Hawaii
  ['us-48', USA, 2019], // Texas
]

// New Zealand, Argentina, Brazil, Kenya, Peru, Ecuador
const DEMO_WISHLIST = ['554', '032', '076', '404', '604', '218']

export async function seedDemoData(): Promise<void> {
  for (const [regionId, countryId, year] of DEMO_VISITS) {
    await markVisited(regionId, countryId, Date.UTC(year, 5, 15))
  }
  await db.places.bulkPut(
    DEMO_WISHLIST.map((regionId) => ({
      regionId,
      countryId: regionId,
      status: 'wishlist' as const,
      firstVisit: null,
      notes: '',
      updatedAt: Date.now(),
    })),
  )
  await db.trips.put({
    id: newId(),
    title: 'South Island road trip',
    regionIds: ['554'],
    startDate: '2026-11-02',
    endDate: '2026-11-21',
    notes: 'Queenstown → Milford Sound → Wanaka. Book the Routeburn early.',
    createdAt: Date.now(),
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.photos, db.places, db.trips, async () => {
    await Promise.all([db.photos.clear(), db.places.clear(), db.trips.clear()])
  })
}
