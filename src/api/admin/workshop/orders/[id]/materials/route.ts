import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { purchaseService } from "../../../../purchases/helpers"
import { loadOrder, syncMaterials, workshopService, type Loose } from "../../../helpers"

/**
 * POST /admin/workshop/orders/:id/materials { item_id?, name?, unit?, required, note? }
 * A catalogue item brings its name and unit; the same item twice adds to the existing line.
 */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  await service.retrieveWorkOrder(id)
  const body = req.validatedBody
  const lines = await service.listWorkMaterials({ order_id: id })
  if (body.item_id) {
    const item = await purchaseService(req).retrievePurchaseItem(body.item_id)
    const same = lines.find((l) => l.item_id === item.id)
    if (same) await service.updateWorkMaterials({ id: same.id, required: (Number(same.required) || 0) + body.required } as Loose)
    else await service.createWorkMaterials({ order_id: id, item_id: item.id, name: item.name, unit: item.unit || "Unidades", required: body.required, note: body.note || null, sort_order: lines.length } as Loose)
  } else {
    await service.createWorkMaterials({ order_id: id, item_id: null, name: body.name.trim(), unit: body.unit || "Unidades", required: body.required, note: body.note || null, sort_order: lines.length } as Loose)
  }
  await syncMaterials(req, id)
  res.status(201).json({ order: await loadOrder(req, id) })
}
