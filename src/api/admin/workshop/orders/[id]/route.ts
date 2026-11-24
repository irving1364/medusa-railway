import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { AFTER_RELEASE, checklistComplete, type WorkStage } from "../../../../../modules/workshop/service"
import { ORDER_FIELDS, clean, loadOrder, logEvent, workshopService, type Loose } from "../../helpers"

const MATERIALS: Loose = { pending: "Pendientes", partial: "Parciales", complete: "Completos" }

/** GET /admin/workshop/orders/:id — with activities and history. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ order: await loadOrder(req, req.params.id) })
}

/** POST /admin/workshop/orders/:id — data, blocker and checklist. The stage changes through /stage. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  const body = req.validatedBody
  const current = await service.retrieveWorkOrder(id)
  const patch: Loose = { id, ...clean(body, ORDER_FIELDS) }
  // The number belongs to the type (OP / OT): the type is fixed once created.
  delete patch.type
  // With material lines the materials state is computed from them (see syncMaterials).
  if ("materials" in patch && (await service.listWorkMaterials({ order_id: id }, { select: ["id"], take: 1 })).length) { delete patch.materials; delete patch.materials_note }

  const notes: string[] = []
  if ("blocked" in body && body.blocked !== current.blocked) {
    patch.blocked = !!body.blocked
    patch.blocked_since = body.blocked ? new Date() : null
    patch.blocker = body.blocked ? (body.blocker || current.blocker || null) : null
    notes.push(body.blocked ? `Bloqueo: ${patch.blocker || "sin causa indicada"}` : `Bloqueo resuelto${current.blocker ? `: ${current.blocker}` : ""}`)
  } else if ("blocker" in body && current.blocked) {
    patch.blocker = body.blocker || null
  }

  if ("checklist" in body) {
    const released = AFTER_RELEASE.includes(current.stage as WorkStage)
    if (released && !checklistComplete(body.checklist)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La orden ya está liberada. Regrésela a Inspección para cambiar la lista.")
    patch.checklist = body.checklist
    const before = Array.isArray(current.checklist) ? (current.checklist as Loose[]).filter((c) => c.done).length : 0
    const after = (body.checklist as Loose[]).filter((c) => c.done).length
    if (after !== before) notes.push(`Inspección: ${after}/${(body.checklist as Loose[]).length} puntos verificados`)
  }
  if ("materials" in body && body.materials !== current.materials) notes.push(`Materiales: ${MATERIALS[body.materials]}`)

  await service.updateWorkOrders(patch)
  if (notes.length) await logEvent(req, id, "updated", notes.join(" · "))
  res.json({ order: await loadOrder(req, id) })
}

/** DELETE /admin/workshop/orders/:id — soft delete of the order and its activities (the number is not reused). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  const mats = await service.listWorkMaterials({ order_id: id }, { select: ["id", "consumed"] })
  if (mats.some((m) => (Number(m.consumed) || 0) > 0)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La orden tiene material consumido. Devuélvalo al stock o cancele la orden en lugar de eliminarla.")
  if (mats.length) await service.softDeleteWorkMaterials(mats.map((m) => m.id))
  const acts = await service.listWorkActivities({ order_id: id }, { select: ["id"] })
  if (acts.length) await service.softDeleteWorkActivities(acts.map((a) => a.id))
  await service.softDeleteWorkOrders([id])
  res.json({ id, object: "work_order", deleted: true })
}
