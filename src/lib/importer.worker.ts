/// <reference lib="webworker" />
import { readPhotoMeta } from './exif'
import { loadAtlas } from './geo'
import { makeThumb } from './thumbs'

/**
 * One photo per message.
 *
 * `file` is always the original, because EXIF has to be read from it - GPS does
 * not survive HEIC conversion. `displayBlob` is what actually gets shown, which
 * for HEIC is a JPEG the main thread converted for us: heic-to renders through
 * `document.createElement('canvas')`, so it throws "document is not defined"
 * in here and cannot run in a worker at all.
 */
export type ImportRequest = { file: File; displayBlob: Blob }

export type ImportedPhoto = {
  fileName: string
  blob: Blob
  thumbBlob: Blob
  lat: number | null
  lon: number | null
  takenAt: number | null
  regionId: string | null
  regionName: string | null
  countryId: string | null
  placedBy: 'contains' | 'nearest' | null
}

export type ImportMessage =
  | { type: 'photo'; photo: ImportedPhoto }
  | { type: 'error'; fileName: string; message: string }

const post = (msg: ImportMessage) => (self as DedicatedWorkerGlobalScope).postMessage(msg)

self.onmessage = async (event: MessageEvent<ImportRequest>) => {
  const { file, displayBlob } = event.data
  try {
    const atlas = await loadAtlas()
    const meta = await readPhotoMeta(file)
    const thumbBlob = await makeThumb(displayBlob)
    const hit = meta.lat !== null && meta.lon !== null ? atlas.locate(meta.lon, meta.lat) : null

    post({
      type: 'photo',
      photo: {
        fileName: file.name,
        blob: displayBlob,
        thumbBlob,
        lat: meta.lat,
        lon: meta.lon,
        takenAt: meta.takenAt,
        regionId: hit?.regionId ?? null,
        regionName: hit?.regionName ?? null,
        countryId: hit?.countryId ?? null,
        placedBy: hit?.method ?? null,
      },
    })
  } catch (err) {
    post({
      type: 'error',
      fileName: file?.name ?? 'unknown',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
