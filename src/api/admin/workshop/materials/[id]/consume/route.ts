import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { roundQty } from "../../../../../../modules/purchase/service"
import { actorEmail, purchaseService } from "../../../../purchases/helpers"
import { loadOrder, logEvent, syncMaterials, workshopService, type Loose } from "../../../helpers"

/**
 * POST /admin/workshop/materials/:id/consume { quantity, note }
 * quantity > 0: the workshop took it (stock goes down); quantity < 0: returned to the warehouse (stock goes up).
 * Stock may go negative when it was never counted: the response warns so someone counts it.
 */
export async function POST(req: AuthenticatedMedusaRequest<{ quantity: number; note?: string | null }>, res: MedusaResponse) {
  const service = workshopService(req)
  const line = await service.retrieveWorkMaterial(req.params.id)
  const { quantity, note } = req.validatedBody
  const consumed = roundQty((Number(line.consumed) || 0) + quantity)
  if (consumed < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Solo se pueden devolver ${Number(line.consumed) || 0} ${String(line.unit).toLowerCase()}`)
  const order = await service.retrieveWorkOrder(line.order_id)
  if (["closed", "cancelled"].includes(order.stage) && quantity > 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La orden está cerrada o cancelada")

  await service.updateWorkMaterials({ id: line.id, consumed } as Loose)
  const warnings: string[] = []
  if (line.item_id) {
    try {
      const { stock } = await purchaseService(req).moveStock({
        item_id: line.item_id, quantity: -quantity, reason: quantity > 0 ? "consumption" : "return",
        ref_type: "work_order", ref_id: order.id, ref_label: order.number, note: note || null, actor_email: await actorEmail(req),
      })
      if (stock < 0) warnings.push(`El stock de «${line.name}» quedó en ${stock}. Registre un conteo en Compras → Materiales.`)
    } catch {
      warnings.push(`«${line.name}» ya no está en el catálogo: el consumo se registró solo en la orden.`)
    }
  }
  await logEvent(req, order.id, "material", `${quantity > 0 ? "Consumo" : "Devolución"}: ${Math.abs(quantity)} ${String(line.unit).toLowerCase()} de ${line.name}${note ? ` · ${note}` : ""}`)
  await syncMaterials(req, order.id)
  res.json({ order: await loadOrder(req, order.id), warnings })
}
