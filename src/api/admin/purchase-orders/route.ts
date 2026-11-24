import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { PurchaseCompany } from "../../../modules/purchase/service"
import { WORKSHOP_MODULE } from "../../../modules/workshop"
import type WorkshopModuleService from "../../../modules/workshop/service"
import { actorEmail, bodyToRow, purchaseService, serialize, type Loose } from "../purchases/helpers"

/** GET /admin/purchase-orders?q=&company=&status=&supplier_id=&limit=&offset= — newest first. `status=pending_payment` = balance > 0 and not cancelled. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const { q, company, status, supplier_id } = req.query as Record<string, string | undefined>
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const filters: Loose = {}
  if (company) filters.company = company
  if (supplier_id) filters.supplier_id = supplier_id
  if (status && status !== "pending_payment") filters.status = status
  if (status === "pending_payment") filters.status = { $ne: "cancelled" }
  if (q) filters.$or = [{ supplier_name: { $ilike: `%${q}%` } }, { number: { $ilike: `%${q}%` } }, { invoice_reference: { $ilike: `%${q}%` } }]
  let [orders, count] = await service.listAndCountPurchaseOrders(filters, { take: status === "pending_payment" ? 200 : limit, skip: status === "pending_payment" ? 0 : offset, order: { created_at: "DESC" } })
  if (status === "pending_payment") { orders = orders.filter((o) => Number(o.total) - Number(o.paid_total) > 0.005); count = orders.length; orders = orders.slice(offset, offset + limit) }
  res.json({ orders: orders.map(serialize), count, limit, offset })
}

/** POST /admin/purchase-orders — draft with the next number of the company; ship-to and terms fall back to the profile. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = purchaseService(req)
  const body = req.validatedBody
  const company = body.company as PurchaseCompany
  const profile = await service.profileFor(company)
  const row = bodyToRow(body)
  if (!row.order_date) row.order_date = new Date()
  for (const k of ["ship_to_name", "ship_to_address", "ship_to_phone", "payment_terms"]) if (row[k] === undefined || row[k] === null || row[k] === "") row[k] = profile[k] || null
  if (!row.lines) { row.lines = []; row.subtotal = 0; row.discount_total = 0; row.tax_total = 0; row.total = 0 }
  if (row.supplier_id) {
    try { const s = await service.retrieveSupplier(row.supplier_id); row.supplier_name = row.supplier_name || s.name; for (const [k, sk] of [["supplier_ruc", "ruc"], ["supplier_contact", "contact_name"], ["supplier_phone", "phone"], ["supplier_email", "email"], ["supplier_address", "address"]] as const) if (!row[k]) row[k] = (s as Loose)[sk] || null; if (!row.payment_terms) row.payment_terms = s.payment_terms || null } catch { /* keep what was sent */ }
  }
  row.number = await service.nextNumber(company)
  row.status = "draft"
  row.paid_total = 0
  const order = await service.createPurchaseOrders(row as Loose)
  await service.createPurchaseEvents({ order_id: order.id, action: "created", actor_email: await actorEmail(req) } as Loose)
  // Bought for a workshop job: the work order remembers it (shown on its materials card).
  const workOrderId = (row.metadata as Loose | null)?.work_order_id
  if (typeof workOrderId === "string" && workOrderId) await linkToWorkOrder(req, workOrderId, order)
  res.status(201).json({ order: serialize(order) })
}

async function linkToWorkOrder(req: AuthenticatedMedusaRequest, workOrderId: string, po: Loose) {
  try {
    const workshop = req.scope.resolve(WORKSHOP_MODULE) as WorkshopModuleService
    const wo = await workshop.retrieveWorkOrder(workOrderId)
    const meta = (wo.metadata || {}) as Loose
    const list = Array.isArray(meta.purchase_orders) ? meta.purchase_orders : []
    await workshop.updateWorkOrders({ id: wo.id, metadata: { ...meta, purchase_orders: [...list, { id: po.id, number: po.number, supplier_name: po.supplier_name }] } } as Loose)
    await workshop.createWorkEvents({ order_id: wo.id, action: "purchase", note: `Orden de compra ${po.number} a ${po.supplier_name}`, actor_email: await actorEmail(req) } as Loose)
  } catch { /* the work order was deleted meanwhile: the purchase stands on its own */ }
}
