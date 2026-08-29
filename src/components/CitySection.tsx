import { useEffect, useMemo, useRef, useState } from 'react'
import { citiesForRegion, searchCities, type CityOption } from '../lib/cities'
import { addCity, removeCity } from '../lib/cityActions'
import type { City, Photo } from '../lib/db'
import type { Region } from '../lib/geo'
import { Button, cx } from './ui/primitives'

type Props = {
  region: Region
  cities: City[]
  photos: Photo[]
  selectedCityId: string | null
  onSelectCity: (cityId: string | null) => void
}

export function CitySection({ region, cities, photos, selectedCityId, onSelectCity }: Props) {
  const [adding, setAdding] = useState(false)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const photo of photos) {
      if (photo.cityId) map.set(photo.cityId, (map.get(photo.cityId) ?? 0) + 1)
    }
    return map
  }, [photos])

  const elsewhere = photos.filter((p) => !p.cityId).length
  const sorted = [...cities].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name),
  )

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
        <h2 className="text-[15px] font-semibold text-text">Cities</h2>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          + Add city
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="py-2 text-[13px] text-text-2">
          Add the cities you visited in {region.name}. Photos taken nearby are filed under
          them automatically.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 py-1">
          {sorted.map((city) => {
            const count = counts.get(city.id) ?? 0
            const active = selectedCityId === city.id
            return (
              <span
                key={city.id}
                className={cx(
                  'group inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[13px] transition-colors',
                  active
                    ? 'border-accent bg-accent-bg text-accent-hover'
                    : 'border-border bg-white text-text hover:bg-bg-hover',
                )}
              >
                <button onClick={() => onSelectCity(active ? null : city.id)}>
                  {city.name}
                  {count > 0 && <span className="ml-1.5 text-text-3 tabular-nums">{count}</span>}
                </button>
                <button
                  onClick={() => {
                    if (active) onSelectCity(null)
                    void removeCity(city.id)
                  }}
                  aria-label={`Remove ${city.name}`}
                  className="text-text-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red"
                >
                  ×
                </button>
              </span>
            )
          })}

          {elsewhere > 0 && (
            <span className="inline-flex items-center px-2 py-1 text-[12px] text-text-3">
              {elsewhere} elsewhere in {region.name}
            </span>
          )}
        </div>
      )}

      {adding && (
        <AddCityDialog
          region={region}
          existing={cities}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  )
}

function AddCityDialog({
  region,
  existing,
  onClose,
}: {
  region: Region
  existing: City[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CityOption[] | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let live = true
    citiesForRegion(region).then((list) => live && setOptions(list))
    return () => {
      live = false
    }
  }, [region])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const taken = new Set(existing.map((c) => c.name.toLowerCase()))
  const results = options ? searchCities(options, query).filter((c) => !taken.has(c.name.toLowerCase())) : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 p-6 pt-[16vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add a city in ${region.name}`}
        className="w-full max-w-[420px] overflow-hidden rounded-md border border-border bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search cities in ${region.name}…`}
          className="w-full border-b border-border px-4 py-3 text-[14px] text-text placeholder:text-text-3 focus:outline-none"
        />

        <div className="thin-scroll max-h-[300px] overflow-y-auto p-1">
          {options === null && (
            <p className="px-3 py-6 text-center text-[13px] text-text-3">Loading cities…</p>
          )}
          {options !== null && results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-text-3">
              {options.length === 0
                ? `No city list available for ${region.name}.`
                : 'No matches.'}
            </p>
          )}
          {results.map((city) => (
            <button
              key={`${city.name}-${city.lat}-${city.lon}`}
              onClick={async () => {
                await addCity(region.id, region.countryId, city)
                onClose()
              }}
              className="flex w-full items-baseline justify-between gap-3 rounded-sm px-3 py-1.5 text-left transition-colors hover:bg-bg-hover"
            >
              <span className="truncate text-[14px] text-text">{city.name}</span>
              <span className="shrink-0 text-[12px] text-text-3 tabular-nums">
                {city.population.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
