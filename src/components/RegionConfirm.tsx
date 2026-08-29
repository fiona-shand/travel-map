import { useEffect } from 'react'
import { metaFor } from '../lib/countryMeta'
import { markVisited, toggleWishlist, type Place } from '../lib/db'
import type { Region } from '../lib/geo'
import { Button } from './ui/primitives'

type Props = {
  region: Region
  place: Place | undefined
  /** Called after "I've been here". Selects it on the globe; never navigates. */
  onConfirmed: (regionId: string) => void
  onClose: () => void
}

/**
 * Shown when you click somewhere new on the globe. Confirms what to do with it
 * before anything is written, then leaves you on the globe.
 */
export function RegionConfirm({ region, place, onConfirmed, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const meta = metaFor(region.countryId)
  const isState = region.countryId !== region.id
  const onWishlist = place?.status === 'wishlist'

  const confirmVisited = async () => {
    await markVisited(region.id, region.countryId, null)
    onConfirmed(region.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${region.name}`}
        className="w-full max-w-[380px] rounded-md border border-border bg-white p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[40px] leading-none">{meta.flag}</div>

        <h2 className="text-[19px] leading-tight font-semibold text-text">{region.name}</h2>
        <p className="mt-0.5 text-[13px] text-text-2">
          {isState ? region.countryName : (meta.continentName ?? 'Disputed territory')}
          {onWishlist && ' · on your wishlist'}
        </p>

        <p className="mt-4 text-[13px] leading-relaxed text-text-2">
          Have you been here? We&rsquo;ll shade it in on your globe. Its page is in the
          sidebar whenever you want to add photos.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" onClick={confirmVisited}>
            Yes, I&rsquo;ve been here
          </Button>
          {!onWishlist && (
            <Button
              onClick={async () => {
                await toggleWishlist(region.id, region.countryId)
                onClose()
              }}
            >
              Not yet — add to wishlist
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
