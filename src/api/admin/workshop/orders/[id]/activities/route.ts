import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ACTIVITY_FIELDS, clean, loadOrder, workshopService, type Loose } from "../../../helpers"

/** POST /admin/workshop/orders/:id/activities — adds an operation at the end of the sequence. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  await service.retrieveWorkOrder(id)
  const existing = await service.listWorkActivities({ order_id: id }, { select: ["sort_order"] })
  const sort_order = existing.reduce((m, a) => Math.max(m, Number(a.sort_order) || 0), -1) + 1
  await service.createWorkActivities({ ...clean(req.validatedBody, ACTIVITY_FIELDS), order_id: id, sort_order } as Loose)
  res.status(201).json({ order: await loadOrder(req, id) })
}
