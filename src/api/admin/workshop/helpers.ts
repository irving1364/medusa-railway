import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { WORKSHOP_MODULE } from "../../../modules/workshop"
import type WorkshopModuleService from "../../../modules/workshop/service"
import { actorEmail } from "../purchases/helpers"

export type Loose = Record<string, any>
export { actorEmail }

export const workshopService = (req: { scope: any }) => req.scope.resolve(WORKSHOP_MODULE) as WorkshopModuleService

const num = (v: unknown, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback }

export const serializeActivity = (a: Loose) => ({ ...a, hours: num(a.hours, 0), actual_hours: a.actual_hours === null || a.actual_hours === undefined ? null : num(a.actual_hours) })
export const serializeResource = (r: Loose) => ({ ...r, weekly_capacity: num(r.weekly_capacity, 40), daily_capacity: num(r.daily_capacity, 9) })
export const serializeOrder = (o: Loose) => ({ ...o, quantity: num(o.quantity, 1), checklist: Array.isArray(o.checklist) ? o.checklist : [] })

/** Order with its activities (in sequence) and history (newest first). */
export async function loadOrder(req: { scope: any }, id: string) {
  const service = workshopService(req)
  const order = await service.retrieveWorkOrder(id)
  const [activities, events] = await Promise.all([
    service.listWorkActivities({ order_id: id }, { order: { sort_order: "ASC", created_at: "ASC" } }),
    service.listWorkEvents({ order_id: id }, { order: { created_at: "DESC" }, take: 100 }),
  ])
  return { ...serializeOrder(order), activities: activities.map(serializeActivity), events }
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
