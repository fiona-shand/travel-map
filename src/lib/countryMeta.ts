import iso from 'i18n-iso-countries'
import { continents, countries as countryData } from 'countries-list'

export type ContinentCode = keyof typeof continents

export type CountryMeta = {
  alpha2: string | null
  continent: ContinentCode | null
  continentName: string | null
  flag: string
}

/** ISO alpha-2 -> regional-indicator pair, e.g. 'FR' -> 🇫🇷. */
function flagEmoji(alpha2: string): string {
  return String.fromCodePoint(
    ...[...alpha2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

const cache = new Map<string, CountryMeta>()

/**
 * Display metadata for a country id. Disputed territories (ids beginning `x-`)
 * have no ISO code, so they fall back to a globe glyph rather than being dropped.
 */
export function metaFor(countryId: string): CountryMeta {
  const hit = cache.get(countryId)
  if (hit) return hit

  let meta: CountryMeta = { alpha2: null, continent: null, continentName: null, flag: '🏳️' }

  if (!countryId.startsWith('x-')) {
    const alpha2 = iso.numericToAlpha2(countryId) ?? null
    const record = alpha2 ? countryData[alpha2 as keyof typeof countryData] : undefined
    if (alpha2) {
      const continent = (record?.continent as ContinentCode | undefined) ?? null
      meta = {
        alpha2,
        continent,
        continentName: continent ? continents[continent] : null,
        flag: flagEmoji(alpha2),
      }
    }
  }

  cache.set(countryId, meta)
  return meta
}

