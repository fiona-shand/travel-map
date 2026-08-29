import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { Place } from '../lib/db'
import { fillFor } from '../lib/fillScale'
import type { Region, WorldAtlas } from '../lib/geo'
import { PALETTE } from '../lib/palette'

type Rotation = [number, number]

type Props = {
  atlas: WorldAtlas
  places: Map<string, Place>
  photoCounts: Map<string, number>
  selected: string | null
  onSelect: (regionId: string | null) => void
  /** Plan mode greys out already-visited places so the wishlist reads first. */
  mode: 'atlas' | 'plan'
}

const MIN_ZOOM = 1
const MAX_ZOOM = 9

/**
 * Adaptive resampling threshold. Higher = fewer interpolated points = faster.
 * We coarsen while the globe is moving and sharpen once it settles, which keeps
 * dragging smooth without giving up crisp coastlines at rest.
 */
const PRECISION_IDLE = 0.4
const PRECISION_MOVING = 2.5

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function Globe({ atlas, places, photoCounts, selected, onSelect, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Mutable render state lives in refs, so dragging never re-renders React.
  const rotation = useRef<Rotation>([-10, -20])
  const zoom = useRef(1)
  const size = useRef({ w: 0, h: 0 })
  const hovered = useRef<string | null>(null)
  const frame = useRef(0)
  const moving = useRef(false)
  const settleTimer = useRef(0)
  const spinRaf = useRef(0)

  const [hoverLabel, setHoverLabel] = useState<{ name: string; x: number; y: number } | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [tilted, setTilted] = useState(true)

  const projection = useMemo(() => geoOrthographic().precision(PRECISION_IDLE), [])

  /**
   * Group regions by fill once per data change, not once per frame. Lets the
   * draw loop issue ~6 fills instead of one per region.
   */
  const batches = useMemo(() => {
    const byFill = new Map<string, Region[]>()
    for (const region of atlas.regions) {
      const place = places.get(region.id)
      const faded = mode === 'plan' && place?.status === 'visited'
      const fill = faded ? PALETTE.land : fillFor(place, photoCounts.get(region.id) ?? 0)
      const bucket = byFill.get(fill)
      if (bucket) bucket.push(region)
      else byFill.set(fill, [region])
    }
    return [...byFill.entries()]
  }, [atlas, places, photoCounts, mode])

  const wishlistRegions = useMemo(
    () => atlas.regions.filter((r) => places.get(r.id)?.status === 'wishlist'),
    [atlas, places],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { w, h } = size.current
    if (!w || !h) return

    // Always full pixel density. Dropping to 1x while dragging saved very
    // little and made the hairline borders shimmer.
    const dpr = Math.min(devicePixelRatio, 2)
    const targetW = Math.round(w * dpr)
    const targetH = Math.round(h * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }

    const radius = (Math.min(w, h) / 2 - 8) * zoom.current
    projection
      .precision(moving.current ? PRECISION_MOVING : PRECISION_IDLE)
      .scale(radius)
      .translate([w / 2, h / 2])
      .rotate(rotation.current)

    const path = geoPath(projection, ctx)

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    ctx.beginPath()
    path({ type: 'Sphere' })
    ctx.fillStyle = PALETTE.ocean
    ctx.fill()

    ctx.beginPath()
    path(geoGraticule10())
    ctx.strokeStyle = PALETTE.graticule
    ctx.lineWidth = 0.6
    ctx.stroke()

    // One geometry pass per fill group, filling and stroking the same path.
    // Borders are drawn on every frame, including mid-drag: hiding them while
    // moving was cheaper but made the globe fall apart in the hand.
    ctx.lineWidth = 0.5
    ctx.strokeStyle = PALETTE.border
    for (const [fill, regions] of batches) {
      ctx.beginPath()
      for (const region of regions) path(region.feature)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.stroke()
    }

    if (wishlistRegions.length) {
      ctx.beginPath()
      for (const region of wishlistRegions) path(region.feature)
      ctx.strokeStyle = PALETTE.yellow
      ctx.lineWidth = 1.1
      ctx.stroke()
    }

    for (const id of [hovered.current, selected]) {
      if (!id) continue
      const isSelected = id === selected
      ctx.beginPath()
      for (const region of atlas.shapesFor(id)) path(region.feature)
      if (isSelected) {
        ctx.fillStyle = 'rgba(35,131,226,0.18)'
        ctx.fill()
      }
      ctx.strokeStyle = isSelected ? PALETTE.accent : PALETTE.borderStrong
      ctx.lineWidth = isSelected ? 1.6 : 1.1
      ctx.stroke()
    }

    ctx.beginPath()
    path({ type: 'Sphere' })
    ctx.strokeStyle = '#dedcd7'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.restore()
  }, [atlas, batches, wishlistRegions, selected, projection])

  const scheduleDraw = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      draw()
    })
  }, [draw])

  /** Coarsen geometry now, then sharpen once the globe has been still briefly. */
  const markMoving = useCallback(() => {
    moving.current = true
    clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      moving.current = false
      scheduleDraw()
    }, 140)
  }, [scheduleDraw])

  /** Ease the globe to a target orientation, taking the short way round. */
  const spinTo = useCallback(
    (target: Rotation, duration = 620) => {
      cancelAnimationFrame(spinRaf.current)
      const from: Rotation = [...rotation.current]
      const deltaLon = ((target[0] - from[0] + 540) % 360) - 180
      const deltaLat = target[1] - from[1]
      const start = performance.now()

      const tick = (now: number) => {
        const t = clamp((now - start) / duration, 0, 1)
        const eased = 1 - (1 - t) ** 3
        rotation.current = [from[0] + deltaLon * eased, from[1] + deltaLat * eased]
        setTilted(Math.abs(rotation.current[1]) > 0.5)
        if (t < 1) {
          moving.current = true
          draw()
          spinRaf.current = requestAnimationFrame(tick)
        } else {
          moving.current = false
          draw()
        }
      }
      spinRaf.current = requestAnimationFrame(tick)
    },
    [draw],
  )

  useEffect(() => () => cancelAnimationFrame(spinRaf.current), [])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    // Only the CSS size is set here; draw() owns the backing-store size so it
    // can switch pixel density between moving and settled.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      size.current = { w: width, h: height }
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      scheduleDraw()
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [scheduleDraw])

  useEffect(scheduleDraw, [scheduleDraw])

  /** Spin the globe so the selected region faces the viewer. */
  useEffect(() => {
    if (!selected) return
    const region = atlas.byId(selected)
    if (!region) return
    const [lon, lat] = geoCentroid(region.feature)
    spinTo([-lon, -lat])
    // Re-aim only when the selection changes, not on every data update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const regionAtPoint = useCallback(
    (clientX: number, clientY: number): Region | null => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return null
      const coords = projection.invert?.([clientX - rect.left, clientY - rect.top])
      if (!coords) return null
      return atlas.regionAt(coords[0], coords[1])
    },
    [atlas, projection],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragging = false
    let moved = 0
    let anchor: [number, number] = [0, 0]
    let startRotation: Rotation = [0, 0]

    // Hover hit-testing walks every region, so run it at most once a frame
    // rather than once per pointermove event.
    let pending: { x: number; y: number } | null = null
    let hoverRaf = 0

    const runHover = () => {
      hoverRaf = 0
      if (!pending) return
      const { x, y } = pending
      pending = null
      const rect = canvas.getBoundingClientRect()
      const hit = regionAtPoint(x, y)
      setHoverLabel(hit ? { name: hit.name, x: x - rect.left, y: y - rect.top } : null)
      if ((hit?.id ?? null) !== hovered.current) {
        hovered.current = hit?.id ?? null
        scheduleDraw()
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      moved = 0
      anchor = [e.clientX, e.clientY]
      startRotation = [...rotation.current]
      cancelAnimationFrame(spinRaf.current)
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        pending = { x: e.clientX, y: e.clientY }
        if (!hoverRaf) hoverRaf = requestAnimationFrame(runHover)
        return
      }

      const dx = e.clientX - anchor[0]
      const dy = e.clientY - anchor[1]
      moved = Math.abs(dx) + Math.abs(dy)

      // Degrees per pixel, so the drag keeps tracking the surface as you zoom.
      const k = 90 / projection.scale()
      rotation.current = [startRotation[0] + dx * k, clamp(startRotation[1] - dy * k, -90, 90)]
      setTilted(Math.abs(rotation.current[1]) > 0.5)
      markMoving()
      scheduleDraw()
    }

    const onPointerUp = (e: PointerEvent) => {
      // A press that barely moved is a click, not a spin.
      if (dragging && moved < 4) {
        const hit = regionAtPoint(e.clientX, e.clientY)
        onSelect(hit?.id ?? null)
      }
      dragging = false
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }

    const onPointerLeave = () => {
      pending = null
      hovered.current = null
      setHoverLabel(null)
      scheduleDraw()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom.current = clamp(zoom.current * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM)
      setZoomLevel(zoom.current)
      markMoving()
      scheduleDraw()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cancelAnimationFrame(hoverRaf)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [regionAtPoint, onSelect, scheduleDraw, markMoving, projection])

  const nudgeZoom = (factor: number) => {
    zoom.current = clamp(zoom.current * factor, MIN_ZOOM, MAX_ZOOM)
    setZoomLevel(zoom.current)
    scheduleDraw()
  }

  const ctrl =
    'flex h-7 w-7 items-center justify-center text-text-2 transition-colors hover:bg-bg-hover disabled:opacity-30'

  return (
    <div ref={wrapRef} className="relative h-full w-full touch-none select-none">
      <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {hoverLabel && (
        <div
          className="pointer-events-none absolute z-10 rounded-sm bg-text px-2 py-1 text-xs font-medium text-white shadow-pop"
          style={{ left: hoverLabel.x + 12, top: hoverLabel.y + 12 }}
        >
          {hoverLabel.name}
        </div>
      )}

      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-md border border-border bg-white shadow-card">
        <button onClick={() => nudgeZoom(1.4)} disabled={zoomLevel >= MAX_ZOOM} aria-label="Zoom in" className={ctrl}>
          +
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => nudgeZoom(1 / 1.4)}
          disabled={zoomLevel <= MIN_ZOOM}
          aria-label="Zoom out"
          className={ctrl}
        >
          −
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => spinTo([rotation.current[0], 0], 480)}
          disabled={!tilted}
          aria-label="Straighten the globe, north up"
          title="North up"
          className={ctrl}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 3.4 L9.7 8 L8 7.1 L6.3 8 Z" fill="currentColor" />
            <path d="M8 12.6 L6.3 8 L8 8.9 L9.7 8 Z" fill="currentColor" opacity="0.35" />
          </svg>
        </button>
      </div>
    </div>
  )
}
