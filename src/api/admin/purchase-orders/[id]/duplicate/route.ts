import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { PurchaseCompany, PurchaseLine } from "../../../../../modules/purchase/service"
import { logEvent, purchaseService, serialize, type Loose } from "../../../purchases/helpers"

/** POST /admin/purchase-orders/:id/duplicate — new draft with the next number, same supplier, lines and terms (nothing received or paid). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const src = await service.retrievePurchaseOrder(req.params.id)
  const { id: _id, number: _n, status: _s, paid_total: _p, sent_at: _sa, confirmed_at: _ca, received_at: _ra, cancelled_at: _xa, last_pdf_url: _u, invoice_reference: _ir, created_at: _c, updated_at: _up, deleted_at: _d, ...rest } = src as Loose
  const order = await service.createPurchaseOrders({
    ...rest,
    number: await service.nextNumber(src.company as PurchaseCompany),
    status: "draft",
    paid_total: 0,
    order_date: new Date(),
    expected_date: null,
    lines: ((src.lines || []) as unknown as PurchaseLine[]).map((l) => ({ ...l, received_qty: 0 })),
    metadata: { ...(rest.metadata || {}), duplicated_from: src.number },
  } as Loose)
  await logEvent(req, order.id, "created", `Duplicada de ${src.number}`)
  res.status(201).json({ order: serialize(order) })
}
