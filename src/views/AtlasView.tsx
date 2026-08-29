import { useState } from 'react'
import { Globe } from '../components/Globe'
import { RegionConfirm } from '../components/RegionConfirm'
import { UnplacedTray } from '../components/UnplacedTray'
import { Button } from '../components/ui/primitives'
import { WORLD_COUNTRY_COUNT } from '../lib/countryMeta'
import { RAMP_THRESHOLDS, VISIT_RAMP } from '../lib/fillScale'
import { assignPhotoToRegion } from '../lib/placePhoto'
import { seedDemoData } from '../lib/seed'
import type { TravelData } from '../lib/useTravelData'
import { useAtlasStore } from '../store/useAtlas'

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="text-[22px] leading-none font-semibold text-text tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-text-3">{label}</div>
    </div>
  )
}

export function AtlasView({ data }: { data: TravelData }) {
  const { atlas, selectedRegion, selectRegion, assigningPhotoId, setAssigning } = useAtlasStore()
  const [pending, setPending] = useState<string | null>(null)

  const handleSelect = async (regionId: string | null) => {
    if (!regionId) {
      selectRegion(null)
      return
    }

    // Filing an unplaced photo takes priority over anything else.
    if (assigningPhotoId && atlas) {
      await assignPhotoToRegion(assigningPhotoId, regionId, atlas)
      setAssigning(null)
      selectRegion(regionId)
      return
    }

    // Somewhere you've already been opens straight up; somewhere new asks first.
    if (data.places.get(regionId)?.status === 'visited') {
      selectRegion(regionId)
      return
    }
    setPending(regionId)
  }

  const pendingRegion = pending && atlas ? atlas.byId(pending) : null
  const pct = ((data.visitedCount / WORLD_COUNTRY_COUNT) * 100).toFixed(0)
  const isEmpty = !data.loading && data.visitedCount === 0 && data.photoCount === 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-9 border-b border-border px-6 py-4">
        <Stat value={data.visitedCount} label="Countries" />
        <Stat value={`${pct}%`} label="Of the world" />
        <Stat value={data.visitedRegionCount} label="Places" />
        <Stat value={data.photoCount} label="Memories" />

        <div className="ml-auto flex items-center gap-2 text-[12px] text-text-3">
          <span>Fewer</span>
          <div className="flex overflow-hidden rounded-xs">
            {VISIT_RAMP.map((color, i) => (
              <span
                key={color}
                className="h-3 w-5"
                style={{ background: color }}
                title={`${RAMP_THRESHOLDS[i]}+ photos`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-bg-subtle/40">
        {atlas ? (
          <Globe
            atlas={atlas}
            places={data.places}
            photoCounts={data.photoCounts}
            selected={selectedRegion}
            onSelect={handleSelect}
            mode="atlas"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-text-3">
            Loading the globe…
          </div>
        )}

        {assigningPhotoId && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <span className="rounded-sm bg-text px-3 py-1.5 text-[13px] text-white shadow-pop">
              Click a place on the globe to file this photo
            </span>
          </div>
        )}

        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-white px-4 py-3 shadow-pop">
              <div>
                <div className="text-[13px] font-medium text-text">Your globe is empty</div>
                <div className="text-[12px] text-text-2">
                  Click anywhere you&rsquo;ve been, or load some sample trips.
                </div>
              </div>
              <Button size="sm" onClick={() => seedDemoData()}>
                Load sample data
              </Button>
            </div>
          </div>
        )}
      </div>

      <UnplacedTray />

      {pendingRegion && (
        <RegionConfirm
          region={pendingRegion}
          place={data.places.get(pendingRegion.id)}
          onConfirmed={(regionId) => {
            setPending(null)
            selectRegion(regionId)
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  )
}
