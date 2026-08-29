import { useEffect, useRef, useState } from 'react'
import { useImporter } from '../lib/useImporter'
import { useAtlasStore } from '../store/useAtlas'
import { Button } from './ui/primitives'

/** Sidebar footer: import buttons, or live progress while a run is going. */
export function ImportControls() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const folderRef = useRef<HTMLInputElement | null>(null)
  const { importFiles } = useImporter()
  const importState = useAtlasStore((s) => s.importState)

  const pct = importState.total ? Math.round((importState.done / importState.total) * 100) : 0

  if (importState.active) {
    return (
      <div className="px-1.5 py-1">
        <div className="flex items-baseline justify-between text-[12px] text-text-2">
          <span className="max-w-[150px] truncate">{importState.fileName || 'Reading…'}</span>
          <span className="tabular-nums">
            {importState.done}/{importState.total}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-active">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="primary" className="flex-1" onClick={() => inputRef.current?.click()}>
        Add photos
      </Button>
      <Button size="sm" onClick={() => folderRef.current?.click()}>
        Folder
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) importFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        hidden
        // @ts-expect-error - non-standard but supported in Chromium and Safari
        webkitdirectory=""
        onChange={(e) => {
          if (e.target.files) importFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Whole-window drag target, so photos can be dropped anywhere. */
export function DropOverlay() {
  const [dragging, setDragging] = useState(false)
  const { importFiles } = useImporter()

  useEffect(() => {
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setDragging(true)
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [importFiles])

  if (!dragging) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/75 backdrop-blur-sm">
      <div className="rounded-md border-2 border-dashed border-accent bg-white px-12 py-10 text-center shadow-pop">
        <div className="mb-2 text-3xl">🌍</div>
        <p className="text-[15px] font-semibold text-text">Drop them anywhere</p>
        <p className="mt-0.5 text-[13px] text-text-2">
          We&rsquo;ll read where each photo was taken and shade it in.
        </p>
      </div>
    </div>
  )
}
