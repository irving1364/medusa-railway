import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { OPEN_STAGES, checklistFor, type WorkType } from "../../../../modules/workshop/service"
import { ACTIVITY_FIELDS, ORDER_FIELDS, clean, loadOrder, logEvent, serializeOrder, workshopService, type Loose } from "../helpers"

/** GET /admin/workshop/orders?company=&stage=open|<stage>&type=&blocked=1&quote_id=&customer_id=&q=&limit= */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = workshopService(req)
  const filters: Loose = {}
  const { company, stage, type, blocked } = req.query as Record<string, string | undefined>
  if (company === "fabmetal" || company === "karven") filters.company = company
  if (stage === "open") filters.stage = OPEN_STAGES
  else if (stage) filters.stage = stage
  if (type) filters.type = type
  if (blocked === "1") filters.blocked = true
  const { quote_id, customer_id } = req.query as Record<string, string | undefined>
  if (quote_id) filters.quote_id = quote_id
  if (customer_id) filters.customer_id = customer_id
  const q = String(req.query.q || "").trim()
  if (q) filters.$or = [{ number: { $ilike: `%${q}%` } }, { title: { $ilike: `%${q}%` } }, { client_name: { $ilike: `%${q}%` } }, { quote_number: { $ilike: `%${q}%` } }]
  const [orders, count] = await service.listAndCountWorkOrders(filters, { take: Math.min(Number(req.query.limit) || 200, 500), order: { due_date: "ASC", created_at: "DESC" } })

  // Progress per order: planned hours done / total.
  const ids = orders.map((o) => o.id)
  const activities = ids.length ? await service.listWorkActivities({ order_id: ids }, { select: ["order_id", "hours", "status", "date"] }) : []
  const progress: Record<string, { total: number; done: number; activities: number; unscheduled: number }> = {}
  for (const a of activities) {
    const p = (progress[a.order_id] ||= { total: 0, done: 0, activities: 0, unscheduled: 0 })
    p.activities += 1
    p.total += Number(a.hours) || 0
    if (a.status === "done") p.done += Number(a.hours) || 0
    else if (!a.date) p.unscheduled += 1
  }
  res.json({ orders: orders.map((o) => ({ ...serializeOrder(o), progress: progress[o.id] || { total: 0, done: 0, activities: 0, unscheduled: 0 } })), count })
}

/** POST /admin/workshop/orders — creates the order with the checklist of its type and, optionally, its activities. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const body = req.validatedBody
  const type = body.type as WorkType
  const row: Loose = { ...clean(body, ORDER_FIELDS), number: await service.nextNumber(type), stage: "preparation" }
  row.checklist = Array.isArray(body.checklist) && body.checklist.length ? body.checklist : checklistFor(type)
  if (body.blocked) { row.blocked = true; row.blocker = body.blocker || null; row.blocked_since = new Date() }
  const order = await service.createWorkOrders(row)
  const acts = (body.activities || []) as Loose[]
  if (acts.length) await service.createWorkActivities(acts.map((a, i) => ({ ...clean(a, ACTIVITY_FIELDS), order_id: order.id, sort_order: i })))
  await logEvent(req, order.id, "created", order.title)
  res.status(201).json({ order: await loadOrder(req, order.id) })
}
