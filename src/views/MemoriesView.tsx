import { useMemo, useState } from 'react'
import { PhotoGrid } from '../components/PhotoGrid'
import { Chip, EmptyState } from '../components/ui/primitives'
import { metaFor } from '../lib/countryMeta'
import { useAllPhotos } from '../lib/useTravelData'

function monthKey(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function MemoriesView() {
  const photos = useAllPhotos()
  const [filter, setFilter] = useState<string | null>(null)

  const regions = useMemo(() => {
    const counts = new Map<string, { name: string; countryId: string; count: number }>()
    for (const p of photos) {
      if (!p.regionId) continue
      const entry = counts.get(p.regionId)
      counts.set(p.regionId, {
        name: p.regionName ?? p.regionId,
        countryId: p.countryId ?? p.regionId,
        count: (entry?.count ?? 0) + 1,
      })
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [photos])

  const shown = filter ? photos.filter((p) => p.regionId === filter) : photos

  const groups = useMemo(() => {
    const map = new Map<string, typeof shown>()
    for (const photo of shown) {
      const key = monthKey(photo.takenAt ?? photo.createdAt)
      map.set(key, [...(map.get(key) ?? []), photo])
    }
    return [...map.entries()]
  }, [shown])

  if (photos.length === 0) {
    return (
      <EmptyState
        icon="📷"
        title="No memories yet"
        body="Drop a few photos anywhere in the app. We read where each one was taken and shade its place in on your globe."
      />
    )
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-white px-6 py-2.5">
        <Chip active={filter === null} onClick={() => setFilter(null)}>
          All {photos.length}
        </Chip>
        {regions.map(([regionId, info]) => (
          <Chip
            key={regionId}
            active={filter === regionId}
            onClick={() => setFilter(filter === regionId ? null : regionId)}
          >
            {metaFor(info.countryId).flag} {info.name} {info.count}
          </Chip>
        ))}
      </div>

      <div className="space-y-7 px-6 py-6">
        {groups.map(([month, items]) => (
          <section key={month}>
            <h2 className="mb-2.5 text-[15px] font-semibold text-text">{month}</h2>
            <PhotoGrid photos={items} columns="grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" />
          </section>
        ))}
      </div>
    </div>
  )
}
