import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadOrder, syncMaterials, workshopService, type Loose } from "../../helpers"

/** POST /admin/workshop/materials/:id — required quantity, note (name/unit only for free-text lines). */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const line = await service.retrieveWorkMaterial(req.params.id)
  const body = req.validatedBody
  const patch: Loose = { id: line.id }
  if (body.required !== undefined) patch.required = body.required
  if ("note" in body) patch.note = body.note || null
  if (!line.item_id) { if (body.name) patch.name = body.name; if (body.unit) patch.unit = body.unit }
  await service.updateWorkMaterials(patch)
  await syncMaterials(req, line.order_id)
  res.json({ order: await loadOrder(req, line.order_id) })
}

/** DELETE /admin/workshop/materials/:id — only while nothing was consumed (return it to stock first). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = workshopService(req)
  const line = await service.retrieveWorkMaterial(req.params.id)
  if ((Number(line.consumed) || 0) > 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Este material ya se consumió. Devuélvalo al stock antes de quitarlo.")
  await service.softDeleteWorkMaterials([line.id])
  await syncMaterials(req, line.order_id)
  res.json({ order: await loadOrder(req, line.order_id) })
}
