import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESOURCE_FIELDS, clean, serializeResource, workshopService, type Loose } from "../../helpers"

/** POST /admin/workshop/resources/:id */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const resource = await workshopService(req).updateWorkshopResources({ id: req.params.id, ...clean(req.validatedBody, RESOURCE_FIELDS) } as Loose)
  res.json({ resource: serializeResource(resource) })
}

/** DELETE /admin/workshop/resources/:id — soft delete; activities keep the id and show "Sin asignar". */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await workshopService(req).softDeleteWorkshopResources([req.params.id])
  res.json({ id: req.params.id, object: "workshop_resource", deleted: true })
}
