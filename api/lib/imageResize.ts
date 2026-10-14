import sharp from "sharp";

/**
 * Resize each incoming pet photo down to ≤1024px max edge and re-encode as
 * WebP at quality 82 BEFORE sending to Claude vision. With 4 photos per scan,
 * the cost amplifier from 6MB phone uploads is even worse for PetView than
 * InnerView — ~$0.04 unresized vs ~$0.013 resized. Strips EXIF, honors
 * orientation.
 */
export async function resizeForVision(
  base64: string,
): Promise<{ data: string; mediaType: "image/webp" }> {
  const buf = Buffer.from(base64, "base64");
  const out = await sharp(buf)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  return { data: out.toString("base64"), mediaType: "image/webp" };
}
