import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { actorEmail, logEvent, purchaseService, serialize, type Loose } from "../../../purchases/helpers"

const toDate = (v: unknown): Date => { if (!v) return new Date(); const s = String(v); const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s); return Number.isNaN(d.getTime()) ? new Date() : d }
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** GET /admin/purchase-orders/:id/payments */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const payments = await purchaseService(req).listPurchasePayments({ order_id: req.params.id }, { order: { paid_at: "DESC" } })
  res.json({ payments: payments.map((p) => ({ ...p, amount: Number(p.amount) || 0 })) })
}

/** POST /admin/purchase-orders/:id/payments — registers a payment (abono) to the supplier; keeps paid_total and the balance. */
export async function POST(req: AuthenticatedMedusaRequest<{ paid_at?: string; amount: number; method?: string | null; reference?: string | null; note?: string | null }>, res: MedusaResponse) {
  const service = purchaseService(req)
  const order = await service.retrievePurchaseOrder(req.params.id)
  if (order.status === "cancelled") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La orden está cancelada")
  const { paid_at, amount, method, reference, note } = req.validatedBody
  const balance = round((Number(order.total) || 0) - (Number(order.paid_total) || 0))
  if (amount > balance + 0.005) throw new MedusaError(MedusaError.Types.INVALID_DATA, `El abono supera el saldo pendiente (${balance.toFixed(2)})`)
  const payment = await service.createPurchasePayments({ order_id: order.id, paid_at: toDate(paid_at), amount, method: method || null, reference: reference || null, note: note || null, actor_email: await actorEmail(req) } as Loose)
  const updated = await service.updatePurchaseOrders({ id: order.id, paid_total: round((Number(order.paid_total) || 0) + amount) } as Loose)
  await logEvent(req, order.id, "payment", note || reference || null, { amount, method: method || null })
  res.status(201).json({ order: serialize(updated), payment: { ...payment, amount: Number(payment.amount) || 0 } })
}

/** DELETE /admin/purchase-orders/:id/payments?payment_id= — removes a payment registered by mistake. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const order = await service.retrievePurchaseOrder(req.params.id)
  const paymentId = String(req.query.payment_id || "")
  const [payment] = await service.listPurchasePayments({ id: paymentId, order_id: order.id }, { take: 1 })
  if (!payment) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Pago no encontrado")
  await service.softDeletePurchasePayments([payment.id])
  const updated = await service.updatePurchaseOrders({ id: order.id, paid_total: round(Math.max(0, (Number(order.paid_total) || 0) - (Number(payment.amount) || 0))) } as Loose)
  await logEvent(req, order.id, "payment_removed", null, { amount: Number(payment.amount) || 0 })
  res.json({ order: serialize(updated), deleted: payment.id })
}
