import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { actorEmail, ensurePortalToken, quoteService, serialize, type Loose } from "../../helpers"

const ALLOWED: Record<string, string[]> = {
  draft: ["sent", "approved", "rejected"],
  sent: ["approved", "rejected", "draft"],
  approved: ["draft"],
  rejected: ["draft"],
}
const LABEL: Record<string, string> = { draft: "borrador", sent: "enviada", approved: "aprobada", rejected: "rechazada" }

/** POST /admin/quotes/:id/status — manual state changes ("Marcar enviada", "Aprobar", "Rechazar", "Reabrir"). */
export async function POST(req: AuthenticatedMedusaRequest<{ status: string; note?: string | null }>, res: MedusaResponse) {
  const service = quoteService(req)
  const quote = await service.retrieveQuote(req.params.id)
  const { status, note } = req.validatedBody
  if (!ALLOWED[quote.status]?.includes(status)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `No se puede pasar de ${LABEL[quote.status]} a ${LABEL[status]}`)
  }
  if (status === "sent" && !(quote.lines as unknown as Loose[])?.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Agregue al menos una línea antes de marcarla como enviada")
  const patch: Loose = { id: quote.id, status }
  const now = new Date()
  if (status === "sent") patch.sent_at = now
  if (status === "approved") patch.approved_at = now
  if (status === "rejected") patch.rejected_at = now
  if (status === "draft" && (quote.status === "approved" || quote.status === "rejected")) { patch.version = (Number(quote.version) || 1) + 1; patch.approved_at = null; patch.rejected_at = null }
  let updated: Loose = await service.updateQuotes(patch)
  if (status === "sent") updated = await ensurePortalToken(req, updated)
  await service.createQuoteRevisions({ quote_id: quote.id, version: updated.version, action: `status:${status}`, snapshot: updated as Loose, note: note || null, actor_email: await actorEmail(req) } as Loose)
  res.json({ quote: serialize(updated) })
}
