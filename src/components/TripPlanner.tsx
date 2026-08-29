import { useState } from 'react'
import { db, newId } from '../lib/db'
import { useTrips } from '../lib/useTravelData'
import { Button, Chip, EmptyState } from './ui/primitives'

type WishlistItem = { regionId: string; name: string; flag: string }

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'No dates yet'
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (start && end) return `${fmt(start)} – ${fmt(end)} ${new Date(`${end}T00:00:00`).getFullYear()}`
  return fmt((start ?? end)!)
}

const field =
  'w-full rounded-sm border border-border bg-white px-2 py-1.5 text-[13px] text-text placeholder:text-text-3 focus:border-accent focus:outline-none'

export function TripPlanner({ wishlist }: { wishlist: WishlistItem[] }) {
  const trips = useTrips()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  const reset = () => {
    setTitle('')
    setPicked([])
    setStartDate('')
    setEndDate('')
    setNotes('')
    setOpen(false)
  }

  const save = async () => {
    if (!title.trim()) return
    await db.trips.add({
      id: newId(),
      title: title.trim(),
      regionIds: picked,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim(),
      createdAt: Date.now(),
    })
    reset()
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-bg-sidebar">
      <div className="flex h-[57px] shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-[14px] font-semibold text-text">Trips</h2>
        <Button size="sm" variant={open ? 'ghost' : 'primary'} onClick={() => setOpen(!open)}>
          {open ? 'Cancel' : 'New trip'}
        </Button>
      </div>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto p-3">
        {open && (
          <div className="space-y-2 rounded-md border border-border bg-white p-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Trip name"
              className={field}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={field}
              />
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={field}
              />
            </div>

            {wishlist.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {wishlist.map((item) => (
                  <Chip
                    key={item.regionId}
                    active={picked.includes(item.regionId)}
                    onClick={() =>
                      setPicked((p) =>
                        p.includes(item.regionId)
                          ? p.filter((id) => id !== item.regionId)
                          : [...p, item.regionId],
                      )
                    }
                  >
                    {item.flag} {item.name}
                  </Chip>
                ))}
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Flights, places to eat, the one thing you can't miss…"
              rows={3}
              className={`${field} resize-none`}
            />
            <Button
              size="sm"
              variant="primary"
              className="w-full"
              disabled={!title.trim()}
              onClick={save}
            >
              Save trip
            </Button>
          </div>
        )}

        {trips.length === 0 && !open && (
          <EmptyState
            icon="✈️"
            title="No trips yet"
            body="Add a few places to your wishlist, then gather them into a trip."
          />
        )}

        {trips.map((trip) => (
          <article key={trip.id} className="group rounded-md border border-border bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-text">{trip.title}</h3>
              <button
                onClick={() => db.trips.delete(trip.id)}
                aria-label={`Delete ${trip.title}`}
                className="text-text-3 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red"
              >
                ×
              </button>
            </div>
            <p className="mt-0.5 text-[12px] text-text-3">
              {formatRange(trip.startDate, trip.endDate)}
            </p>
            {trip.regionIds.length > 0 && (
              <p className="mt-1.5 text-[12px] text-text-2">
                {trip.regionIds
                  .map((id) => wishlist.find((w) => w.regionId === id)?.name ?? id)
                  .join(' · ')}
              </p>
            )}
            {trip.notes && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-text">{trip.notes}</p>
            )}
          </article>
        ))}
      </div>
    </aside>
  )
}
