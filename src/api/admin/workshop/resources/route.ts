import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESOURCE_FIELDS, clean, serializeResource, workshopService, type Loose } from "../helpers"

/** GET /admin/workshop/resources?active=1 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const filters: Loose = {}
  if (req.query.active === "1") filters.active = true
  const resources = await workshopService(req).listWorkshopResources(filters, { order: { sort_order: "ASC", name: "ASC" } })
  res.json({ resources: resources.map(serializeResource) })
}

/** POST /admin/workshop/resources */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const resource = await workshopService(req).createWorkshopResources({ active: true, ...clean(req.validatedBody, RESOURCE_FIELDS) } as Loose)
  res.status(201).json({ resource: serializeResource(resource) })
}
