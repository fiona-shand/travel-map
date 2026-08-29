import exifr from 'exifr'

export type PhotoMeta = {
  lat: number | null
  lon: number | null
  takenAt: number | null
}

const HEIC_EXT = /\.(heic|heif)$/i

/**
 * exifr parses HEIF containers, so GPS reads fine straight off an iPhone.
 * Rendering is the separate problem - see `toDisplayBlob`.
 */
export function looksHeic(file: File): boolean {
  return HEIC_EXT.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
}

/** Pull GPS and capture date. Never throws - a bad file just yields nulls. */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    const parsed = await exifr.parse(file, {
      gps: true,
      pick: ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal', 'CreateDate'],
    })

    const taken = parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? null
    const takenAt = taken instanceof Date && !Number.isNaN(taken.valueOf()) ? taken.valueOf() : null

    const lat = typeof parsed?.latitude === 'number' ? parsed.latitude : null
    const lon = typeof parsed?.longitude === 'number' ? parsed.longitude : null

    return { lat, lon, takenAt }
  } catch {
    return { lat: null, lon: null, takenAt: null }
  }
}

export type ConversionResult = { blob: Blob; converted: boolean; error?: string }

/**
 * Browsers cannot render HEIC, so convert it before we ever put it in an <img>.
 * The libheif wasm is dynamically imported so JPEG-only imports never pay for it.
 *
 * A failure here must never be swallowed: keeping the original HEIC produces a
 * photo that saves correctly but is invisible everywhere in the UI, which looks
 * exactly like the import having done nothing.
 */
export async function toDisplayBlob(file: File): Promise<ConversionResult> {
  if (!looksHeic(file)) return { blob: file, converted: false }
  try {
    const { heicTo } = await import('heic-to')
    const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
    return { blob, converted: true }
  } catch (err) {
    return {
      blob: file,
      converted: false,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    }
  }
}
