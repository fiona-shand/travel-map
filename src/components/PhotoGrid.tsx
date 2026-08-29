import { useEffect, useMemo, useState } from 'react'
import type { Photo } from '../lib/db'
import { cx } from './ui/primitives'

/** Object URLs are revoked on unmount so long sessions don't leak blobs. */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

export function formatTaken(photo: Photo): string {
  const at = photo.takenAt ?? photo.createdAt
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function Thumb({ photo, onClick }: { photo: Photo; onClick?: () => void }) {
  const url = useBlobUrl(photo.thumbBlob)
  return (
    <button
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-sm bg-bg-subtle focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      {url && (
        <img
          src={url}
          alt={photo.caption || photo.fileName}
          loading="lazy"
          className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
        />
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pt-5 pb-1.5 text-left text-[11px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {formatTaken(photo)}
      </span>
    </button>
  )
}

export function PhotoGrid({ photos, columns = 'grid-cols-3' }: { photos: Photo[]; columns?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <div className={cx('grid gap-1.5', columns)}>
        {photos.map((photo, i) => (
          <Thumb key={photo.id} photo={photo} onClick={() => setOpenIndex(i)} />
        ))}
      </div>
      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  )
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: Photo[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const photo = photos[index]
  const url = useBlobUrl(photo?.blob)

  const step = useMemo(
    () => (delta: number) => onIndex((index + delta + photos.length) % photos.length),
    [index, photos.length, onIndex],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {url && (
          <img
            src={url}
            alt={photo.caption || photo.fileName}
            className="max-h-[74vh] rounded-sm object-contain"
          />
        )}
        <div className="flex items-center gap-5 text-white">
          <button onClick={() => step(-1)} className="text-2xl opacity-60 hover:opacity-100">
            ‹
          </button>
          <div className="text-center">
            <p className="text-[14px] font-medium">{photo.regionName ?? 'Unplaced'}</p>
            <p className="text-[12px] opacity-60">
              {formatTaken(photo)} · {index + 1} of {photos.length}
            </p>
          </div>
          <button onClick={() => step(1)} className="text-2xl opacity-60 hover:opacity-100">
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
