import { useState } from 'react'
import { metaFor } from '../lib/countryMeta'
import { USA } from '../lib/geo'
import type { TravelData } from '../lib/useTravelData'
import { useAtlasStore, type ViewMode } from '../store/useAtlas'
import { ImportControls } from './ImportDropzone'
import { ResetDialog } from './ResetDialog'
import { SectionLabel, cx } from './ui/primitives'

const NAV: { id: ViewMode; icon: string; label: string }[] = [
  { id: 'atlas', icon: '🌍', label: 'Atlas' },
  { id: 'plan', icon: '✈️', label: 'Plan trips' },
  { id: 'memories', icon: '🖼️', label: 'Memories' },
]

function Row({
  icon,
  label,
  trailing,
  active,
  indent,
  onClick,
}: {
  icon: string
  label: string
  trailing?: string | number
  active?: boolean
  indent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-sm py-1 pr-2 text-left text-[14px] transition-colors duration-100',
        indent ? 'pl-6' : 'pl-2',
        active ? 'bg-bg-active font-medium text-text' : 'text-text-2 hover:bg-bg-hover',
      )}
    >
      <span className="w-[18px] shrink-0 text-center text-[14px] leading-none">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing !== undefined && trailing !== '' && (
        <span className="shrink-0 text-[12px] text-text-3 tabular-nums">{trailing}</span>
      )}
    </button>
  )
}

export function Sidebar({ data }: { data: TravelData }) {
  const { view, setView, selectedRegion, openRegionId, openRegion, atlas } = useAtlasStore()
  const [resetting, setResetting] = useState(false)

  const entries = [...data.places.entries()].map(([regionId, place]) => ({
    regionId,
    place,
    name: atlas?.nameOf(regionId) ?? regionId,
    flag: metaFor(place.countryId).flag,
    isState: place.countryId === USA && regionId !== USA,
    count: data.photoCounts.get(regionId) ?? 0,
  }))

  const visited = entries.filter((e) => e.place.status === 'visited')
  const wishlist = entries
    .filter((e) => e.place.status === 'wishlist')
    .sort((a, b) => a.name.localeCompare(b.name))

  // US states are grouped under one "United States" heading rather than
  // scattered alphabetically through the country list.
  const visitedStates = visited.filter((e) => e.isState).sort((a, b) => a.name.localeCompare(b.name))
  const visitedCountries = visited
    .filter((e) => !e.isState)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  // The sidebar is how you get into a place's page; clicking the globe only
  // highlights it.
  const open = (regionId: string) => {
    setView('atlas')
    openRegion(regionId)
  }

  return (
    <aside className="flex h-dvh w-[240px] shrink-0 flex-col border-r border-border bg-bg-sidebar">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="text-[15px]">📍</span>
        <span className="text-[14px] font-semibold text-text">Travel Pin</span>
      </div>

      <nav className="px-1.5">
        {NAV.map((item) => (
          <Row
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={view === item.id && !openRegionId}
            onClick={() => setView(item.id)}
          />
        ))}
      </nav>

      <div className="thin-scroll mt-1 flex-1 overflow-y-auto px-1.5 pb-2">
        {visited.length > 0 && (
          <>
            <SectionLabel>VISITED · {data.visitedCount} countries</SectionLabel>
            {visitedCountries.map((entry) => (
              <Row
                key={entry.regionId}
                icon={entry.flag}
                label={entry.name}
                trailing={entry.count || ''}
                active={openRegionId === entry.regionId || selectedRegion === entry.regionId}
                onClick={() => open(entry.regionId)}
              />
            ))}

            {visitedStates.length > 0 && (
              <>
                <div className="flex items-center gap-2 py-1 pr-2 pl-2 text-[14px] text-text-2">
                  <span className="w-[18px] shrink-0 text-center">🇺🇸</span>
                  <span className="min-w-0 flex-1 truncate">United States</span>
                  <span className="text-[12px] text-text-3">{visitedStates.length}</span>
                </div>
                {visitedStates.map((entry) => (
                  <Row
                    key={entry.regionId}
                    icon="•"
                    label={entry.name}
                    trailing={entry.count || ''}
                    indent
                    active={openRegionId === entry.regionId || selectedRegion === entry.regionId}
                    onClick={() => open(entry.regionId)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {wishlist.length > 0 && (
          <>
            <SectionLabel>WISHLIST · {wishlist.length}</SectionLabel>
            {wishlist.map((entry) => (
              <Row
                key={entry.regionId}
                icon={entry.flag}
                label={entry.name}
                active={openRegionId === entry.regionId || selectedRegion === entry.regionId}
                onClick={() => open(entry.regionId)}
              />
            ))}
          </>
        )}

        {data.unplacedCount > 0 && (
          <>
            <SectionLabel>NEEDS A HOME</SectionLabel>
            <Row
              icon="❓"
              label="Unplaced photos"
              trailing={data.unplacedCount}
              onClick={() => setView('atlas')}
            />
          </>
        )}
      </div>

      <div className="border-t border-border p-2">
        <ImportControls />
        <button
          onClick={() => setResetting(true)}
          className="mt-1.5 w-full rounded-sm px-2 py-1 text-left text-[12px] text-text-3 transition-colors hover:bg-bg-hover hover:text-text"
        >
          Start fresh…
        </button>
      </div>

      {resetting && <ResetDialog data={data} onClose={() => setResetting(false)} />}
    </aside>
  )
}
