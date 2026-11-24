import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { OPEN_STAGES } from "../../../../modules/workshop/service"
import { serializeActivity, serializeOrder, serializeResource, workshopService, type Loose } from "../helpers"

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /admin/workshop/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD&company=
 * Activities planned in the range, activities still to plan (open orders), the orders involved and the people.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const from = String(req.query.from || ""), to = String(req.query.to || "")
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Rango de fechas no válido")
  const service = workshopService(req)
  const company = req.query.company === "fabmetal" || req.query.company === "karven" ? String(req.query.company) : null

  const [planned, resources, openOrders] = await Promise.all([
    service.listWorkActivities({ date: { $gte: from, $lte: to } } as Loose, { order: { date: "ASC", sort_order: "ASC" } }),
    service.listWorkshopResources({}, { order: { sort_order: "ASC", name: "ASC" }, withDeleted: true } as Loose),
    service.listWorkOrders({ stage: OPEN_STAGES, ...(company ? { company } : {}) } as Loose, { order: { due_date: "ASC" } }),
  ])
  const openIds = openOrders.map((o) => o.id)
  const unscheduled = openIds.length ? await service.listWorkActivities({ order_id: openIds, date: null, status: ["pending", "in_progress"] } as Loose, { order: { sort_order: "ASC" } }) : []

  // Orders referenced by the planned activities may be closed already (history of the week).
  const known = new Set(openIds)
  const missing = [...new Set(planned.map((a) => a.order_id).filter((id) => !known.has(id)))]
  const others = missing.length ? await service.listWorkOrders({ id: missing, ...(company ? { company } : {}) } as Loose) : []
  const orders = [...openOrders, ...others]
  const visible = new Set(orders.map((o) => o.id))

  res.json({
    from, to,
    resources: resources.map(serializeResource),
    orders: orders.map(serializeOrder),
    activities: planned.filter((a) => visible.has(a.order_id)).map(serializeActivity),
    unscheduled: unscheduled.map(serializeActivity),
  })
}
