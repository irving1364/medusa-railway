import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { WORKSHOP_MODULE } from "../../../modules/workshop"
import type WorkshopModuleService from "../../../modules/workshop/service"
import { actorEmail, purchaseService } from "../purchases/helpers"

export type Loose = Record<string, any>
export { actorEmail }

export const workshopService = (req: { scope: any }) => req.scope.resolve(WORKSHOP_MODULE) as WorkshopModuleService

const num = (v: unknown, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback }

export const serializeActivity = (a: Loose) => ({ ...a, hours: num(a.hours, 0), actual_hours: a.actual_hours === null || a.actual_hours === undefined ? null : num(a.actual_hours) })
export const serializeResource = (r: Loose) => ({ ...r, weekly_capacity: num(r.weekly_capacity, 40), daily_capacity: num(r.daily_capacity, 9) })
export const serializeOrder = (o: Loose) => ({ ...o, quantity: num(o.quantity, 1), checklist: Array.isArray(o.checklist) ? o.checklist : [] })

/** Material line with the stock of its catalogue item: what is still needed and what has to be bought. */
export const serializeMaterial = (m: Loose, item?: Loose | null): Loose => {
  const required = num(m.required, 0), consumed = num(m.consumed, 0)
  const remaining = Math.max(0, Math.round((required - consumed) * 1000) / 1000)
  const stock = item ? num(item.stock, 0) : null
  const shortfall = remaining === 0 ? 0 : stock === null ? remaining : Math.max(0, Math.round((remaining - Math.max(0, stock)) * 1000) / 1000)
  return { ...m, required, consumed, remaining, stock, min_stock: item?.min_stock === null || item?.min_stock === undefined ? null : num(item.min_stock), last_price: item?.last_price === null || item?.last_price === undefined ? null : num(item.last_price), item_ref: item?.ref || null, shortfall }
}

/** Material lines of one or more orders with their catalogue items (one query each). */
export async function loadMaterials(req: { scope: any }, orderIds: string[]) {
  if (!orderIds.length) return []
  const lines = await workshopService(req).listWorkMaterials({ order_id: orderIds }, { order: { sort_order: "ASC", created_at: "ASC" } })
  const itemIds = [...new Set(lines.map((l) => l.item_id).filter(Boolean))] as string[]
  const items = itemIds.length ? await purchaseService(req).listPurchaseItems({ id: itemIds }, { withDeleted: true } as Loose) : []
  const byId = new Map(items.map((i) => [i.id, i as Loose]))
  return lines.map((l) => serializeMaterial(l, l.item_id ? byId.get(l.item_id) : null))
}

/** Order with its activities (in sequence), materials, purchase orders and history (newest first). */
export async function loadOrder(req: { scope: any }, id: string) {
  const service = workshopService(req)
  const order = await service.retrieveWorkOrder(id)
  const [activities, events, material_lines] = await Promise.all([
    service.listWorkActivities({ order_id: id }, { order: { sort_order: "ASC", created_at: "ASC" } }),
    service.listWorkEvents({ order_id: id }, { order: { created_at: "DESC" }, take: 100 }),
    loadMaterials(req, [id]),
  ])
  // Purchase orders made for this job, with their current status.
  const linked = (((order.metadata || {}) as Loose).purchase_orders || []) as Loose[]
  let purchase_orders: Loose[] = []
  if (linked.length) {
    const found = await purchaseService(req).listPurchaseOrders({ id: linked.map((p) => p.id) }, { select: ["id", "number", "status", "supplier_name", "expected_date", "total"] })
    purchase_orders = found.map((p) => ({ ...p, total: num(p.total) }))
  }
  return { ...serializeOrder(order), activities: activities.map(serializeActivity), material_lines, purchase_orders, events }
}

const MAT_LABEL: Loose = { pending: "Pendientes", partial: "Parciales", complete: "Completos" }

/**
 * With material lines, the materials state of the order follows them: complete when every line is consumed
 * or covered by stock, partial when some are, pending otherwise. The note lists what is missing.
 */
export async function syncMaterials(req: AuthenticatedMedusaRequest, orderId: string) {
  const service = workshopService(req)
  const lines = await loadMaterials(req, [orderId])
  if (!lines.length) return
  const covered = lines.filter((l) => l.shortfall === 0)
  const state = covered.length === lines.length ? "complete" : covered.length > 0 || lines.some((l) => l.consumed > 0) ? "partial" : "pending"
  const missing = lines.filter((l) => l.shortfall > 0).map((l) => `${l.name} (${l.shortfall} ${String(l.unit).toLowerCase()})`).join(", ").slice(0, 1900) || null
  const order = await service.retrieveWorkOrder(orderId)
  if (order.materials === state && (order.materials_note || null) === missing) return
  await service.updateWorkOrders({ id: orderId, materials: state, materials_note: missing } as Loose)
  if (order.materials !== state) await logEvent(req, orderId, "updated", `Materiales: ${MAT_LABEL[state]} (automático)`)
}

export async function logEvent(req: AuthenticatedMedusaRequest, order_id: string, action: string, note: string | null = null, data: Loose | null = null) {
  await workshopService(req).createWorkEvents({ order_id, action, note, data, actor_email: await actorEmail(req) } as Loose)
}

/** "" → null for optional text fields coming from the forms. */
export const clean = (body: Loose, keys: string[]) => {
  const row: Loose = {}
  for (const k of keys) if (k in body) row[k] = typeof body[k] === "string" && body[k].trim() === "" ? null : body[k]
  return row
}

export const ORDER_FIELDS = ["company", "type", "title", "description", "client_name", "customer_id", "quote_id", "quote_number", "quantity", "due_date", "finish_date", "priority", "materials", "materials_note", "owner_id", "next_action", "notes", "delivery_note", "metadata"]
export const ACTIVITY_FIELDS = ["name", "date", "resource_id", "hours", "actual_hours", "status", "sort_order", "notes"]
export const RESOURCE_FIELDS = ["name", "role", "weekly_capacity", "daily_capacity", "active", "sort_order"]

/** Stock of these materials changed in Compras (receipt, count): refresh the materials state of the open orders that use them. */
export async function resyncForItems(req: AuthenticatedMedusaRequest, itemIds: string[]) {
  if (!itemIds.length) return
  try {
    const service = workshopService(req)
    const lines = await service.listWorkMaterials({ item_id: itemIds }, { select: ["order_id"] })
    const orderIds = [...new Set(lines.map((l) => l.order_id))]
    if (!orderIds.length) return
    const open = await service.listWorkOrders({ id: orderIds, stage: ["preparation", "scheduled", "in_progress", "inspection"] } as Loose, { select: ["id"] })
    for (const o of open) await syncMaterials(req, o.id)
  } catch { /* the workshop view refreshes on the next change anyway */ }
}
