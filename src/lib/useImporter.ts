import { useCallback, useEffect, useRef } from 'react'
import { db, markVisited, newId } from './db'
import { looksHeic, toDisplayBlob } from './exif'
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
  const cancelled = useRef(false)
  const setImportState = useAtlasStore((s) => s.setImportState)

  useEffect(() => {
    return () => {
      cancelled.current = true
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
    async (fileList: FileList | File[], fallback?: ImportFallback) => {
      const files = Array.from(fileList).filter(isImage)
      if (files.length === 0) return

      cancelled.current = false
      workerRef.current?.terminate()
      const worker = new Worker(new URL('./importer.worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      const runInWorker = (request: ImportRequest) =>
        new Promise<ImportMessage>((resolve) => {
          worker.onmessage = (e: MessageEvent<ImportMessage>) => resolve(e.data)
          worker.onerror = (e) =>
            resolve({ type: 'error', fileName: request.file.name, message: e.message })
          worker.postMessage(request)
        })

      setImportState({ active: true, done: 0, total: files.length, fileName: '', unplaced: 0 })
      let unplaced = 0

      // One file at a time, so a large import never holds every converted
      // JPEG in memory at once.
      for (let i = 0; i < files.length; i++) {
        if (cancelled.current) break
        const file = files[i]
        setImportState({ done: i, total: files.length, fileName: file.name })

        // HEIC has to be converted here on the main thread - see the worker.
        const display = await toDisplayBlob(file)
        if (display.error) {
          console.warn(`[travel-pin] could not convert ${file.name}: ${display.error}`)
        }

        const msg = await runInWorker({ file, displayBlob: display.blob })

        if (msg.type === 'error') {
          console.warn(`[travel-pin] skipped ${msg.fileName}: ${msg.message}`)
          continue
        }

        // A HEIC we failed to convert would be stored unrenderable, which looks
        // exactly like the import silently doing nothing. Better to skip it.
        if (looksHeic(file) && !display.converted) continue

        const p = msg.photo
        const regionId = p.regionId ?? fallback?.regionId ?? null
        const regionName = p.regionName ?? fallback?.regionName ?? null
        const countryId = p.countryId ?? fallback?.countryId ?? null

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
          placedBy: p.placedBy ?? (fallback ? 'manual' : null),
          caption: '',
          createdAt: Date.now(),
        })

        if (regionId && countryId) {
          await markVisited(regionId, countryId, p.takenAt)
        } else {
          unplaced++
          setImportState({ unplaced })
        }
      }

      setImportState({ active: false, done: files.length, fileName: '' })
      worker.terminate()
      workerRef.current = null
    },
    [setImportState],
  )

  return { importFiles }
}
