import { db, type Photo } from '../lib/db'
import { useUnplacedPhotos } from '../lib/useTravelData'
import { useAtlasStore } from '../store/useAtlas'
import { useBlobUrl } from './PhotoGrid'
import { Button, cx } from './ui/primitives'

function TrayThumb({
  photo,
  active,
  onClick,
}: {
  photo: Photo
  active: boolean
  onClick: () => void
}) {
  const url = useBlobUrl(photo.thumbBlob)
  return (
    <button
      onClick={onClick}
      title={photo.fileName}
      className={cx(
        'h-12 w-12 shrink-0 overflow-hidden rounded-sm border-2 transition-all duration-100',
        active ? 'border-accent' : 'border-transparent hover:border-border-strong',
      )}
    >
      {url && <img src={url} alt={photo.fileName} className="h-full w-full object-cover" />}
    </button>
  )
}

/**
 * Photos we could not place: no GPS, stripped GPS (very common for anything
 * that has been through social media), or a coordinate too far from land.
 * Pick one, then click its home on the globe.
 */
export function UnplacedTray() {
  const photos = useUnplacedPhotos()
  const { assigningPhotoId, setAssigning } = useAtlasStore()

  if (photos.length === 0) return null

  const active = photos.find((p) => p.id === assigningPhotoId) ?? null

  return (
    <div className="shrink-0 border-t border-border bg-bg-sidebar px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-medium text-text">
            {photos.length} photo{photos.length === 1 ? '' : 's'} without a location
          </h3>
          <p className="text-[12px] text-text-2">
            {active
              ? `Now click a place on the globe to file “${active.fileName}”.`
              : 'Pick one, then click its place on the globe.'}
          </p>
        </div>
        {active && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await db.photos.delete(active.id)
                setAssigning(null)
              }}
            >
              Discard
            </Button>
          </div>
        )}
      </div>

      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {photos.map((photo) => (
          <TrayThumb
            key={photo.id}
            photo={photo}
            active={photo.id === assigningPhotoId}
            onClick={() => setAssigning(photo.id === assigningPhotoId ? null : photo.id)}
          />
        ))}
      </div>
    </div>
  )
}
