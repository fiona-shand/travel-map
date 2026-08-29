/// <reference lib="webworker" />
import { readPhotoMeta, toDisplayBlob } from './exif'
import { loadAtlas } from './geo'
import { makeThumb } from './thumbs'

export type ImportRequest = { files: File[] }

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
  | { type: 'progress'; done: number; total: number; fileName: string }
  | { type: 'photo'; photo: ImportedPhoto }
  | { type: 'done'; total: number }
  | { type: 'error'; message: string }

const post = (msg: ImportMessage) => (self as DedicatedWorkerGlobalScope).postMessage(msg)

self.onmessage = async (event: MessageEvent<ImportRequest>) => {
  const { files } = event.data
  try {
    const atlas = await loadAtlas()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      post({ type: 'progress', done: i, total: files.length, fileName: file.name })

      const meta = await readPhotoMeta(file)
      const blob = await toDisplayBlob(file)
      const thumbBlob = await makeThumb(blob)

      const hit = meta.lat !== null && meta.lon !== null ? atlas.locate(meta.lon, meta.lat) : null

      post({
        type: 'photo',
        photo: {
          fileName: file.name,
          blob,
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
    }

    post({ type: 'done', total: files.length })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
