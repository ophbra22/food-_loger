/** Limits of the backend's upload endpoints (images.py): JPEG/PNG/WebP, 8 MiB, 20 megapixels. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_PIXELS = 20_000_000;

/**
 * Photos are re-encoded as JPEG before upload. Phone cameras produce HEIC or
 * 12–48 megapixel files that the server would reject; 1600 px on the long edge
 * is plenty for a 224 px classifier and for reading a barcode.
 */
export const UPLOAD_LONG_EDGE = 1600;
export const UPLOAD_JPEG_QUALITY = 0.8;

/** Target size that keeps the aspect ratio and never enlarges a small picture. */
export function uploadSize(width: number, height: number, longEdge = UPLOAD_LONG_EDGE) {
  const longest = Math.max(width, height);
  if (!(longest > 0)) return null;
  if (longest <= longEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = longEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
