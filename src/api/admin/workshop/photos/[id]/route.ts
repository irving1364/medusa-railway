import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { loadOrder, logEvent, workshopService, type Loose } from "../../helpers"

/** POST /admin/workshop/photos/:id { kind, caption } */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const photo = await service.retrieveWorkImage(req.params.id)
  const body = req.validatedBody
  const patch: Loose = { id: photo.id }
  if (body.kind) patch.kind = body.kind
  if ("caption" in body) patch.caption = body.caption || null
  await service.updateWorkImages(patch)
  res.json({ order: await loadOrder(req, photo.order_id) })
}

/**
 * DELETE /admin/workshop/photos/:id — removes the photo and its file.
 * Evidence of a released or delivered order is kept (it backs the quality release / delivery).
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = workshopService(req)
  const photo = await service.retrieveWorkImage(req.params.id)
  const order = await service.retrieveWorkOrder(photo.order_id)
  const locked = (photo.kind === "inspection" && !!order.released_at) || (photo.kind === "delivery" && !!order.delivered_at)
  if (locked) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Esta foto respalda una liberación o entrega registrada y no se puede borrar.")
  await service.softDeleteWorkImages([photo.id])
  if (photo.file_id) {
    try { await (req.scope.resolve(Modules.FILE) as { deleteFiles: (ids: string[]) => Promise<void> }).deleteFiles([photo.file_id]) } catch { /* file already gone */ }
  }
  await logEvent(req, order.id, "photo", "Foto eliminada")
  res.json({ order: await loadOrder(req, order.id) })
}
