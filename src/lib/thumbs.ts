const THUMB_MAX = 400

/**
 * Downscale to a ~400px WebP so grids never decode full-size photos.
 * Runs off the main thread via OffscreenCanvas when available.
 */
export async function makeThumb(blob: Blob, max = THUMB_MAX): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return blob
  }

  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  try {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(bitmap, 0, 0, w, h)
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
  } catch {
    return blob
  } finally {
    bitmap.close()
  }
}
