import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { PurchaseLine } from "../../../../modules/purchase/service"
import { bodyToRow, logEvent, purchaseService, serialize, type Loose } from "../../purchases/helpers"

/** GET /admin/purchase-orders/:id — order with its receipts, payments and history. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const order = await service.retrievePurchaseOrder(req.params.id)
  const [receipts, payments, events] = await Promise.all([
    service.listPurchaseReceipts({ order_id: order.id }, { order: { received_at: "DESC" } }),
    service.listPurchasePayments({ order_id: order.id }, { order: { paid_at: "DESC" } }),
    service.listPurchaseEvents({ order_id: order.id }, { order: { created_at: "DESC" }, take: 200 }),
  ])
  res.json({ order: serialize(order), receipts, payments: payments.map((p) => ({ ...p, amount: Number(p.amount) || 0 })), events })
}

/** POST /admin/purchase-orders/:id — edits; content is locked once received or cancelled (notes and invoice reference stay editable). */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = purchaseService(req)
  const current = await service.retrievePurchaseOrder(req.params.id)
  const row = bodyToRow(req.validatedBody, (current.lines || []) as unknown as PurchaseLine[])
  const contentKeys = Object.keys(row).filter((k) => !["notes_internal", "invoice_reference", "metadata", "expected_date", "payment_terms"].includes(k))
  if ((current.status === "received" || current.status === "cancelled") && contentKeys.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `La orden está ${current.status === "received" ? "recibida" : "cancelada"}; no se puede modificar su contenido`)
  }
  if ("lines" in row && (current.status === "partial")) {
    // keep received quantities consistent: a line cannot drop below what was already received
    for (const l of row.lines as PurchaseLine[]) if (l.received_qty > l.quantity) throw new MedusaError(MedusaError.Types.INVALID_DATA, `La línea "${l.title}" ya tiene ${l.received_qty} recibidas; la cantidad no puede ser menor`)
  }
  const order = await service.updatePurchaseOrders({ id: current.id, ...row } as Loose)
  if (contentKeys.length) await logEvent(req, order.id, "updated", null, { fields: contentKeys })
  res.json({ order: serialize(order) })
}

/** DELETE /admin/purchase-orders/:id — soft delete (the number is not reused; receipts, payments and history stay in the database). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const current = await service.retrievePurchaseOrder(req.params.id)
  await service.softDeletePurchaseOrders([current.id])
  res.json({ id: current.id, object: "purchase_order", deleted: true })
}
