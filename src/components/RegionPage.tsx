import { useEffect, useRef, useState } from 'react'
import { metaFor } from '../lib/countryMeta'
import { clearPlace, db, markVisited, toggleWishlist, type Place } from '../lib/db'
import type { Region } from '../lib/geo'
import { useImporter } from '../lib/useImporter'
import { useRegionPhotos } from '../lib/useTravelData'
import { useAtlasStore } from '../store/useAtlas'
import { PhotoGrid } from './PhotoGrid'
import { Button, EmptyState, Property } from './ui/primitives'

/** A country or state opened as its own page, Notion-style. */
export function RegionPage({ region, place }: { region: Region; place: Place | undefined }) {
  const photos = useRegionPhotos(region.id)
  const [notes, setNotes] = useState(place?.notes ?? '')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { importFiles } = useImporter()
  const importState = useAtlasStore((s) => s.importState)

  useEffect(() => setNotes(place?.notes ?? ''), [place?.notes, region.id])

  const meta = metaFor(region.countryId)
  const visited = place?.status === 'visited'
  const isState = region.countryId !== region.id

  const saveNotes = async (value: string) => {
    setNotes(value)
    const existing = await db.places.get(region.id)
    if (existing) await db.places.put({ ...existing, notes: value, updatedAt: Date.now() })
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-12 py-10">
        <div className="mb-3 text-[58px] leading-none">{meta.flag}</div>
        <h1 className="text-[40px] leading-tight font-bold tracking-tight text-text">
          {region.name}
        </h1>

        <div className="mt-5 mb-8">
          <Property label="Status">
            <span
              className={
                visited
                  ? 'rounded-xs bg-accent-bg px-1.5 py-0.5 text-accent-hover'
                  : place?.status === 'wishlist'
                    ? 'rounded-xs bg-yellow-bg px-1.5 py-0.5 text-text'
                    : 'text-text-3'
              }
            >
              {visited ? 'Visited' : place?.status === 'wishlist' ? 'Wishlist' : 'Not yet'}
            </span>
          </Property>
          {isState && <Property label="Country">{region.countryName}</Property>}
          <Property label="Continent">{meta.continentName ?? '—'}</Property>
          <Property label="First visit">
            {place?.firstVisit ? new Date(place.firstVisit).toLocaleDateString() : '—'}
          </Property>
          <Property label="Memories">{photos.length}</Property>
        </div>

        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          placeholder={place ? 'Write something about this place…' : ''}
          disabled={!place}
          rows={2}
          className="w-full resize-none rounded-sm px-2 py-1.5 text-sm text-text placeholder:text-text-3 hover:bg-bg-subtle focus:bg-bg-subtle focus:outline-none disabled:opacity-40"
        />

        <div className="mt-4 mb-9 flex gap-2">
          {visited ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={photos.length > 0}
              title={photos.length > 0 ? 'Remove its photos first' : undefined}
              onClick={() => clearPlace(region.id)}
            >
              {photos.length > 0 ? 'Has photos — can’t unmark' : 'Unmark as visited'}
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => markVisited(region.id, region.countryId, null)}
              >
                I’ve been here
              </Button>
              <Button size="sm" onClick={() => toggleWishlist(region.id, region.countryId)}>
                {place?.status === 'wishlist' ? 'Remove from wishlist' : 'Add to wishlist'}
              </Button>
            </>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between border-b border-border pb-1.5">
          <h2 className="text-[15px] font-semibold text-text">Memories</h2>
          <Button
            size="sm"
            variant="primary"
            disabled={importState.active}
            onClick={() => inputRef.current?.click()}
          >
            {importState.active
              ? `Adding ${importState.done}/${importState.total}…`
              : `Add photos`}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) {
                // Anything without usable GPS still belongs here - you opened
                // this page to add it, so don't send it to the unplaced tray.
                importFiles(e.target.files, {
                  regionId: region.id,
                  regionName: region.name,
                  countryId: region.countryId,
                })
              }
              e.target.value = ''
            }}
          />
        </div>

        {photos.length > 0 ? (
          <PhotoGrid photos={photos} columns="grid-cols-3 sm:grid-cols-4" />
        ) : (
          <EmptyState
            icon="📷"
            title="Nothing here yet"
            body={`Add photos from ${region.name} — or drop them anywhere in the app and we'll file them by where they were taken.`}
            action={
              <Button size="sm" onClick={() => inputRef.current?.click()}>
                Add photos
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
