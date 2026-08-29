import { useEffect, useState } from 'react'
import { clearAllData } from '../lib/db'
import type { TravelData } from '../lib/useTravelData'
import { Button } from './ui/primitives'

/**
 * Deleting someone's whole travel history is not undoable, so it always
 * confirms first and spells out exactly what is about to go.
 */
export function ResetDialog({ data, onClose }: { data: TravelData; onClose: () => void }) {
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !working) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, working])

  const nothingToClear = data.photoCount === 0 && data.places.size === 0

  const parts = [
    data.photoCount > 0 && `${data.photoCount} photo${data.photoCount === 1 ? '' : 's'}`,
    data.places.size > 0 && `${data.places.size} place${data.places.size === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6"
      onClick={() => !working && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reset all data"
        className="w-full max-w-[380px] rounded-md border border-border bg-white p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-text">Start fresh?</h2>

        {nothingToClear ? (
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            There&rsquo;s nothing stored in this browser — you&rsquo;re already starting from
            a clean slate.
          </p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            This permanently deletes {parts.join(' and ')} from this browser. Your original
            photo files on your computer are untouched. This can&rsquo;t be undone.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={working} onClick={onClose}>
            {nothingToClear ? 'Close' : 'Cancel'}
          </Button>
          {!nothingToClear && (
            <Button
              variant="danger"
              disabled={working}
              onClick={async () => {
                setWorking(true)
                await clearAllData()
                setWorking(false)
                onClose()
              }}
            >
              {working ? 'Deleting…' : 'Delete everything'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
