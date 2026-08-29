import type { Place } from './db'
import { PALETTE, RAMP_THRESHOLDS, VISIT_RAMP } from './palette'

export { RAMP_THRESHOLDS, VISIT_RAMP }

export function rampIndex(photoCount: number): number {
  let index = 0
  for (let i = 0; i < RAMP_THRESHOLDS.length; i++) {
    if (photoCount >= RAMP_THRESHOLDS[i]) index = i
  }
  return index
}

/**
 * A country's fill. Visited always reads clearly against the grey land, even
 * with zero photos - you can mark somewhere visited without photographing it.
 */
export function fillFor(place: Place | undefined, photoCount: number): string {
  if (!place) return PALETTE.land
  if (place.status === 'wishlist') return PALETTE.yellowBg
  return VISIT_RAMP[rampIndex(photoCount)]
}
