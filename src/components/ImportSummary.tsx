import { useAtlasStore } from '../store/useAtlas'

/**
 * What the last import actually did.
 *
 * Without this an import can look like it did nothing: photos with no GPS drop
 * quietly into the unplaced tray, and a file that fails is skipped with only a
 * console warning. Both read as "upload doesn't work".
 */
export function ImportSummary() {
  const summary = useAtlasStore((s) => s.importSummary)
  const dismiss = useAtlasStore((s) => s.setImportSummary)
  const setView = useAtlasStore((s) => s.setView)

  if (!summary) return null

  const { added, unplaced, failed, quotaHit, firstError } = summary
  const placed = added - unplaced
  const bad = failed > 0 || quotaHit

  const parts: string[] = []
  if (placed > 0) parts.push(`${placed} placed on your globe`)
  if (unplaced > 0) parts.push(`${unplaced} with no location`)
  if (failed > 0) parts.push(`${failed} skipped`)

  return (
    <div
      className={`flex shrink-0 items-start gap-3 border-b px-4 py-2.5 text-[13px] ${
        bad ? 'border-border bg-yellow-bg' : 'border-border bg-accent-bg'
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="font-medium text-text">
          {added > 0 ? `Added ${added} photo${added === 1 ? '' : 's'}` : 'No photos added'}
        </span>
        {parts.length > 0 && <span className="text-text-2"> — {parts.join(', ')}</span>}

        {quotaHit && (
          <p className="mt-1 text-text-2">
            This browser ran out of storage for photos. Free some up with “Start fresh…”,
            or import fewer at a time.
          </p>
        )}
        {!quotaHit && failed > 0 && firstError && (
          <p className="mt-1 truncate text-text-2" title={firstError}>
            First problem — {firstError}
          </p>
        )}
        {unplaced > 0 && (
          <p className="mt-1 text-text-2">
            Photos with no GPS wait in the tray under the globe — pick one, then click
            where it belongs.{' '}
            <button
              onClick={() => {
                setView('atlas')
                dismiss(null)
              }}
              className="underline underline-offset-2 hover:text-text"
            >
              Show me
            </button>
          </p>
        )}
      </div>

      <button
        onClick={() => dismiss(null)}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm px-1.5 text-text-3 transition-colors hover:bg-bg-hover hover:text-text"
      >
        ×
      </button>
    </div>
  )
}
