import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { logEvent, purchaseService, serialize, type Loose } from "../../../purchases/helpers"

const ALLOWED: Record<string, string[]> = {
  draft: ["sent", "confirmed", "cancelled"],
  sent: ["confirmed", "draft", "cancelled"],
  confirmed: ["cancelled", "draft"],
  partial: ["cancelled"],
  received: [],
  cancelled: ["draft"],
}
const LABEL: Record<string, string> = { draft: "borrador", sent: "enviada", confirmed: "confirmada", partial: "recibida parcial", received: "recibida", cancelled: "cancelada" }

/** POST /admin/purchase-orders/:id/status — manual moves; "received"/"partial" are set by receipts, not here. */
export async function POST(req: AuthenticatedMedusaRequest<{ status: string; note?: string | null }>, res: MedusaResponse) {
  const service = purchaseService(req)
  const order = await service.retrievePurchaseOrder(req.params.id)
  const { status, note } = req.validatedBody
  if (!ALLOWED[order.status]?.includes(status)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `No se puede pasar de ${LABEL[order.status]} a ${LABEL[status]}`)
  if ((status === "sent" || status === "confirmed") && !(order.lines as unknown as Loose[])?.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Agregue al menos una línea")
  const patch: Loose = { id: order.id, status }
  const now = new Date()
  if (status === "sent") patch.sent_at = now
  if (status === "confirmed") patch.confirmed_at = now
  if (status === "cancelled") patch.cancelled_at = now
  if (status === "draft") { patch.cancelled_at = null }
  const updated = await service.updatePurchaseOrders(patch)
  await logEvent(req, order.id, `status:${status}`, note || null)
  res.json({ order: serialize(updated) })
}
