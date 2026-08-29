import { useCallback, useEffect, useRef } from 'react'
import { db, markVisited, newId } from './db'
import type { ImportMessage, ImportRequest } from './importer.worker'
import { useAtlasStore } from '../store/useAtlas'

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?)$/i

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_RE.test(file.name)
}

/** Where to file photos that carry no usable GPS. */
export type ImportFallback = { regionId: string; regionName: string; countryId: string }

export function useImporter() {
  const workerRef = useRef<Worker | null>(null)
  const setImportState = useAtlasStore((s) => s.setImportState)

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  /**
   * `fallback` is set when importing from a region's own page: anything we
   * can't geo-locate is filed there instead of landing in the unplaced tray,
   * since you've already told us where those photos belong.
   */
  const importFiles = useCallback(
    (fileList: FileList | File[], fallback?: ImportFallback) => {
      const files = Array.from(fileList).filter(isImage)
      if (files.length === 0) return

      workerRef.current?.terminate()
      const worker = new Worker(new URL('./importer.worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      setImportState({ active: true, done: 0, total: files.length, fileName: '', unplaced: 0 })

      worker.onmessage = async (event: MessageEvent<ImportMessage>) => {
        const msg = event.data

        if (msg.type === 'progress') {
          setImportState({ done: msg.done, total: msg.total, fileName: msg.fileName })
          return
        }

        if (msg.type === 'photo') {
          const p = msg.photo
          const regionId = p.regionId ?? fallback?.regionId ?? null
          const regionName = p.regionName ?? fallback?.regionName ?? null
          const countryId = p.countryId ?? fallback?.countryId ?? null
          const placedBy = p.placedBy ?? (fallback ? 'manual' : null)

          await db.photos.add({
            id: newId(),
            blob: p.blob,
            thumbBlob: p.thumbBlob,
            fileName: p.fileName,
            takenAt: p.takenAt,
            lat: p.lat,
            lon: p.lon,
            regionId,
            regionName,
            countryId,
            placedBy,
            caption: '',
            createdAt: Date.now(),
          })

          if (regionId && countryId) {
            await markVisited(regionId, countryId, p.takenAt)
          } else {
            setImportState({ unplaced: useAtlasStore.getState().importState.unplaced + 1 })
          }
          return
        }

        if (msg.type === 'done') {
          setImportState({ active: false, done: msg.total, fileName: '' })
          worker.terminate()
          workerRef.current = null
          return
        }

        if (msg.type === 'error') {
          setImportState({ active: false, fileName: msg.message })
          worker.terminate()
          workerRef.current = null
        }
      }

      worker.postMessage({ files } satisfies ImportRequest)
    },
    [setImportState],
  )

  return { importFiles }
}
