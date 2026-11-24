import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import sharp from "sharp"

/** Longest side of the web version. Catalogue photos never need more; next/image resizes further per screen. */
const MAX_EDGE = 1600
const WEBP_QUALITY = 82
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_FILE_BYTES = 25 * 1024 * 1024

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff", "image/avif", "image/heic", "image/heif"])

type Uploaded = { originalname: string; mimetype: string; buffer: Buffer; size: number }

const baseName = (name: string) =>
  name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "imagen"

/**
 * POST /admin/web-uploads — product photos and documents.
 * Images are rotated per EXIF, resized to fit 1600 px and re-encoded as WebP (no cropping); other files (PDF) are stored as sent.
 * `?raw=1` keeps images exactly as uploaded (logos for PDFs, which only accept PNG/JPG).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const input = (req as unknown as { files?: Uploaded[] }).files
  if (!input?.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "No se recibió ningún archivo")

  const raw = req.query.raw === "1" || req.query.raw === "true"
  const prepared: { filename: string; mimeType: string; content: string; access: "public"; meta: Record<string, unknown> }[] = []
  for (const file of input) {
    // multer decodes file names as latin1; restore UTF-8 so accents survive ("móvil", not "mÃ³vil")
    const f = { ...file, originalname: Buffer.from(file.originalname, "latin1").toString("utf8") }
    const isImage = IMAGE_TYPES.has(f.mimetype)
    if (f.size > (isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${f.originalname} supera el tamaño permitido (${isImage ? "15" : "25"} MB)`)
    }
    if (!isImage || raw) {
      prepared.push({ filename: f.originalname, mimeType: f.mimetype, content: f.buffer.toString("base64"), access: "public", meta: { optimized: false, size: f.size, original_name: f.originalname } })
      continue
    }
    try {
      const { data, info } = await sharp(f.buffer, { animated: false })
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      prepared.push({
        filename: `${baseName(f.originalname)}.webp`,
        mimeType: "image/webp",
        content: data.toString("base64"),
        access: "public",
        meta: { optimized: true, width: info.width, height: info.height, size: info.size, original_size: f.size, original_name: f.originalname },
      })
    } catch (e) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${f.originalname}: no se pudo procesar la imagen (${e instanceof Error ? e.message : "formato no soportado"})`)
    }
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({ input: { files: prepared.map(({ meta: _m, ...file }) => file) } })
  const files = (result as { id: string; url: string }[]).map((r, i) => ({ id: r.id, url: r.url, name: prepared[i].filename, ...prepared[i].meta }))
  res.status(200).json({ files })
}
