// Client-side image preprocessing.
//
// Why this matters: phone cameras hand us 4-8MB photos at 4032×3024. Claude
// Vision charges per image token (~1 token per 0.75 megapixel chunk). A
// 4032×3024 photo = ~4500 tokens per image. A 1024px-long-edge image = ~960.
// Plus, oversized base64 payloads inflate bandwidth and occasionally trip
// upstream limits. This shrinks every photo to ~1MB JPEG before upload.

const MAX_LONG_EDGE = 1280;
const JPEG_QUALITY = 0.85;

export interface PreprocessOptions {
  maxLongEdge?: number;
  quality?: number;
  /** Optional center-crop after resize. e.g. 0.85 keeps the central 85%. */
  centerCrop?: number;
}

/**
 * Read a File (from <input type="file">) → resize, recompress, return base64.
 * Always outputs JPEG for consistent backend MIME handling.
 */
export async function preprocessFile(
  file: File,
  opts: PreprocessOptions = {},
): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  return preprocessDataUrl(dataUrl, opts);
}

/**
 * Same as preprocessFile but takes an existing data URL (e.g. from a webcam
 * canvas) instead of a File.
 */
export async function preprocessDataUrl(
  dataUrl: string,
  opts: PreprocessOptions = {},
): Promise<string> {
  const maxLongEdge = opts.maxLongEdge ?? MAX_LONG_EDGE;
  const quality = opts.quality ?? JPEG_QUALITY;
  const crop = opts.centerCrop ?? 1;

  const img = await loadImage(dataUrl);
  const { width: srcW, height: srcH } = img;

  // Compute target dimensions: scale so the long edge ≤ maxLongEdge
  const longEdge = Math.max(srcW, srcH);
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
  const targetW = Math.round(srcW * scale);
  const targetH = Math.round(srcH * scale);

  // Apply center crop if requested
  const cropW = Math.round(targetW * crop);
  const cropH = Math.round(targetH * crop);
  const offsetX = Math.round((targetW - cropW) / 2);
  const offsetY = Math.round((targetH - cropH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // High-quality downscale
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -offsetX, -offsetY, targetW, targetH);

  return canvas.toDataURL("image/jpeg", quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}

/**
 * Approximate base64 string size in bytes (3/4 of length, ignoring padding).
 * Useful for surfacing "this image is too large" before upload.
 */
export function base64Bytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}
