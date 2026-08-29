import { useCallback, useEffect, useRef } from 'react'
import { cityForPhoto } from './cityActions'
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

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export function useImporter() {
  const workerRef = useRef<Worker | null>(null)
  const cancelled = useRef(false)
  const setImportState = useAtlasStore((s) => s.setImportState)
  const setSummary = useAtlasStore((s) => s.setImportSummary)

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

      setSummary(null)
      setImportState({ active: true, done: 0, total: files.length, fileName: '', unplaced: 0 })

      let added = 0
      let unplaced = 0
      let failed = 0
      let quotaHit = false
      let firstError: string | null = null

      const fail = (fileName: string, err: unknown) => {
        failed++
        if (isQuotaError(err)) quotaHit = true
        const message = err instanceof Error ? err.message : String(err)
        firstError ??= `${fileName}: ${message}`
        console.warn(`[travel-pin] skipped ${fileName}: ${message}`)
      }

      try {
        // One file at a time, so a large import never holds every converted
        // JPEG in memory at once.
        for (let i = 0; i < files.length; i++) {
          if (cancelled.current) break
          const file = files[i]
          setImportState({ done: i, total: files.length, fileName: file.name })

          // Every file is isolated: one unreadable photo, or one write that
          // blows the storage quota, must not abandon the whole import and
          // leave the progress bar stuck at whatever it had reached.
          try {
            // HEIC has to be converted here on the main thread - see the worker.
            const display = await toDisplayBlob(file)
            if (display.error) {
              fail(file.name, new Error(`could not convert HEIC (${display.error})`))
              continue
            }

            const msg = await runInWorker({ file, displayBlob: display.blob })
            if (msg.type === 'error') {
              fail(msg.fileName, new Error(msg.message))
              continue
            }

            // A HEIC we failed to convert would be stored unrenderable, which
            // looks exactly like the import silently doing nothing.
            if (looksHeic(file) && !display.converted) {
              fail(file.name, new Error('HEIC could not be converted'))
              continue
            }

            const p = msg.photo
            const regionId = p.regionId ?? fallback?.regionId ?? null
            const regionName = p.regionName ?? fallback?.regionName ?? null
            const countryId = p.countryId ?? fallback?.countryId ?? null

            await db.photos.add({
              id: newId(),
              cityId: await cityForPhoto({ regionId, lat: p.lat, lon: p.lon }),
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
            added++

            if (regionId && countryId) {
              await markVisited(regionId, countryId, p.takenAt)
            } else {
              unplaced++
              setImportState({ unplaced })
            }
          } catch (err) {
            fail(file.name, err)
            // No point grinding through hundreds more files once storage is full.
            if (isQuotaError(err)) break
          }
        }
      } finally {
        // Always runs, so the progress bar can never be left spinning.
        setImportState({ active: false, done: files.length, fileName: '' })
        setSummary({ added, unplaced, failed, quotaHit, firstError })
        worker.terminate()
        workerRef.current = null
      }
    },
    [setImportState, setSummary],
  )

  return { importFiles }
}
