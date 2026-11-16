import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { PurchaseLine } from "../../../../../modules/purchase/service"
import { actorEmail, logEvent, purchaseService, serialize, type Loose } from "../../../purchases/helpers"

const toDate = (v: unknown): Date => { if (!v) return new Date(); const s = String(v); const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s); return Number.isNaN(d.getTime()) ? new Date() : d }

/** GET /admin/purchase-orders/:id/receipts */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ receipts: await purchaseService(req).listPurchaseReceipts({ order_id: req.params.id }, { order: { received_at: "DESC" } }) })
}

/**
 * POST /admin/purchase-orders/:id/receipts — registers goods received (partial allowed). Updates received quantities,
 * moves the order to "partial" or "received" and remembers the prices paid per catalogue item.
 */
export async function POST(req: AuthenticatedMedusaRequest<{ received_at?: string; reference?: string | null; note?: string | null; lines: { line_id: string; quantity: number }[] }>, res: MedusaResponse) {
  const service = purchaseService(req)
  const order = await service.retrievePurchaseOrder(req.params.id)
  if (order.status === "cancelled") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La orden está cancelada")
  if (order.status === "draft") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Confirme o envíe la orden antes de registrar recepciones")
  const { received_at, reference, note, lines: input } = req.validatedBody
  const lines = ((order.lines || []) as unknown as PurchaseLine[]).map((l) => ({ ...l }))
  const applied: { line_id: string; quantity: number }[] = []
  for (const r of input) {
    const line = lines.find((l) => l.id === r.line_id)
    if (!line) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Línea ${r.line_id} no existe en la orden`)
    if (!(r.quantity > 0)) continue
    const remaining = Math.max(0, (Number(line.quantity) || 0) - (Number(line.received_qty) || 0))
    if (r.quantity > remaining + 1e-9) throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${line.title}": solo faltan ${remaining} por recibir`)
    line.received_qty = Math.round(((Number(line.received_qty) || 0) + r.quantity) * 1000) / 1000
    applied.push({ line_id: line.id, quantity: r.quantity })
  }
  if (!applied.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Indique al menos una cantidad recibida")
  const receipt = await service.createPurchaseReceipts({ order_id: order.id, received_at: toDate(received_at), reference: reference || null, lines: applied, note: note || null, actor_email: await actorEmail(req) } as Loose)
  const status = service.receptionStatus(lines, order.status as never)
  const patch: Loose = { id: order.id, lines, status }
  if (status === "received") patch.received_at = new Date()
  if (reference && !order.invoice_reference) patch.invoice_reference = reference
  const updated = await service.updatePurchaseOrders(patch)
  await service.rememberPrices(lines.filter((l) => applied.some((a) => a.line_id === l.id)), order.supplier_id || null, order.supplier_name || null)
  await logEvent(req, order.id, "receipt", note || reference || null, { lines: applied, status })
  res.status(201).json({ order: serialize(updated), receipt })
}
