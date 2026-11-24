import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { WorkStage } from "../../../../../../modules/workshop/service"
import { actorEmail, loadOrder, logEvent, workshopService, type Loose } from "../../../helpers"

const STAGE_LABEL: Record<WorkStage, string> = {
  preparation: "Preparación", scheduled: "Programado", in_progress: "En proceso", inspection: "En inspección",
  released: "Liberado", delivered: "Entregado", closed: "Cerrado", cancelled: "Cancelado",
}

/** POST /admin/workshop/orders/:id/stage { stage, note } — enforces the quality rules (see service.stageChange). */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  const { stage, note } = req.validatedBody as { stage: WorkStage; note?: string | null }
  const order = await service.retrieveWorkOrder(id)
  const patch = service.stageChange(order, stage, await actorEmail(req))
  if (Object.keys(patch).length) {
    if (stage === "delivered" && note) patch.delivery_note = note
    await service.updateWorkOrders({ id, ...patch })
    await logEvent(req, id, "stage", `${STAGE_LABEL[order.stage as WorkStage]} → ${STAGE_LABEL[stage]}${note ? ` · ${note}` : ""}`, { from: order.stage, to: stage })
  }
  res.json({ order: await loadOrder(req, id) })
}
