import { useState } from 'react'
import { Globe } from '../components/Globe'
import { RegionConfirm } from '../components/RegionConfirm'
import { UnplacedTray } from '../components/UnplacedTray'
import { Button } from '../components/ui/primitives'
import { WORLD_COUNTRY_COUNT } from '../lib/countryMeta'
import { RAMP_THRESHOLDS, VISIT_RAMP } from '../lib/fillScale'
import { assignPhotoToRegion } from '../lib/placePhoto'
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
  const { atlas, selectedRegion, selectRegion, openRegion, assigningPhotoId, setAssigning } =
    useAtlasStore()
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

    // Somewhere you've already been just highlights on the globe - opening its
    // page is done from the sidebar. Somewhere new asks first.
    if (data.places.get(regionId)?.status === 'visited') {
      selectRegion(regionId)
      return
    }
    setPending(regionId)
  }

  const pendingRegion = pending && atlas ? atlas.byId(pending) : null

  // A selected place gets a small card with a way into its page, since
  // clicking the globe deliberately doesn't navigate.
  const selectedPlace =
    selectedRegion && atlas && data.places.get(selectedRegion)
      ? {
          id: selectedRegion,
          name: atlas.nameOf(selectedRegion),
          count: data.photoCounts.get(selectedRegion) ?? 0,
        }
      : null
  const pct = ((data.visitedCount / WORLD_COUNTRY_COUNT) * 100).toFixed(0)
  const isEmpty = !data.loading && data.visitedCount === 0 && data.photoCount === 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-9 border-b border-border px-6 py-4">
        <Stat value={data.visitedCount} label="Countries" />
        <Stat value={`${pct}%`} label="Of the world" />
        <Stat value={data.visitedRegionCount} label="Places" />
        <Stat value={data.photoCount} label="Memories" />

        {/* The ramp needs to say what it counts - "fewer/more" of what, on its
            own, means nothing. */}
        <div className="ml-auto flex items-center gap-2 text-[12px] text-text-3">
          <span>Photos per place</span>
          <div className="flex overflow-hidden rounded-xs border border-border">
            {VISIT_RAMP.map((color, i) => (
              <span
                key={color}
                className="h-3 w-5"
                style={{ background: color }}
                title={`${RAMP_THRESHOLDS[i]}${i === VISIT_RAMP.length - 1 ? '+' : `–${RAMP_THRESHOLDS[i + 1] - 1}`} photos`}
              />
            ))}
          </div>
          <span className="tabular-nums">
            0 → {RAMP_THRESHOLDS[RAMP_THRESHOLDS.length - 1]}+
          </span>
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

        {selectedPlace && (
          <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md border border-border bg-white py-2 pr-2 pl-3 shadow-pop">
            <div>
              <div className="text-[13px] font-medium text-text">{selectedPlace.name}</div>
              <div className="text-[12px] text-text-2">
                {selectedPlace.count === 0
                  ? 'No photos yet'
                  : `${selectedPlace.count} ${selectedPlace.count === 1 ? 'memory' : 'memories'}`}
              </div>
            </div>
            <Button size="sm" onClick={() => openRegion(selectedPlace.id)}>
              Open page
            </Button>
          </div>
        )}

        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <div className="rounded-md border border-border bg-white px-4 py-3 text-center shadow-pop">
              <div className="text-[13px] font-medium text-text">Your globe is empty</div>
              <div className="text-[12px] text-text-2">
                Click anywhere you&rsquo;ve been to shade it in, or add photos to fill it
                in automatically.
              </div>
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
            openRegion(regionId)
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  )
}
