import { Globe } from '../components/Globe'
import { TripPlanner } from '../components/TripPlanner'
import { metaFor } from '../lib/countryMeta'
import { toggleWishlist } from '../lib/db'
import type { TravelData } from '../lib/useTravelData'
import { useAtlasStore } from '../store/useAtlas'

export function PlanView({ data }: { data: TravelData }) {
  const { atlas } = useAtlasStore()

  const wishlist = [...data.places.entries()]
    .filter(([, place]) => place.status === 'wishlist')
    .map(([regionId, place]) => ({
      regionId,
      name: atlas?.nameOf(regionId) ?? regionId,
      flag: metaFor(place.countryId).flag,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Where to next?</h2>
            <p className="text-[12px] text-text-2">
              Click anywhere on the globe to add it to your wishlist
            </p>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-text-3">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-xs border border-yellow bg-yellow-bg" />
              Wishlist
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-xs bg-land" />
              Already been
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-bg-subtle/40">
          {atlas ? (
            <Globe
              atlas={atlas}
              places={data.places}
              photoCounts={data.photoCounts}
              selected={null}
              mode="plan"
              onSelect={(regionId) => {
                if (!regionId) return
                const region = atlas.byId(regionId)
                if (region) void toggleWishlist(region.id, region.countryId)
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-text-3">
              Loading the globe…
            </div>
          )}
        </div>
      </div>

      <TripPlanner wishlist={wishlist} />
    </div>
  )
}
