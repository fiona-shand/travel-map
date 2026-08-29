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

/**
 * Browsers cannot render HEIC, so convert it before we ever put it in an <img>.
 * The libheif wasm is dynamically imported so JPEG-only imports never pay for it.
 */
export async function toDisplayBlob(file: File): Promise<Blob> {
  if (!looksHeic(file)) return file
  try {
    const { heicTo } = await import('heic-to')
    return await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
  } catch {
    // Conversion failed - keep the original so the photo is still placed on the
    // map and stored, even though its preview may not render.
    return file
  }
}
