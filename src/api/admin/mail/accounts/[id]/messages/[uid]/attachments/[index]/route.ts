import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAttachment } from "../../../../../../../../../modules/mail/client"
import { accountSettings, folderParam, mailCall, uidParam } from "../../../../../../helpers"

/** Types a browser may show inline; everything else is always downloaded. */
const INLINE = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/i

/** GET /admin/mail/accounts/:id/messages/:uid/attachments/:index?folder=&download=1 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const file = await mailCall(() => getAttachment(settings, folderParam(req), uidParam(req), Number(req.params.index) || 0))
  const inline = req.query.download !== "1" && INLINE.test(file.content_type)
  const ascii = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  res.setHeader("Content-Type", inline ? file.content_type : "application/octet-stream")
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'")
  res.setHeader("Cache-Control", "private, no-store")
  res.send(file.content)
}
