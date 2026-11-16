import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { purchaseService, type Loose } from "../../purchases/helpers"

/** POST /admin/purchase-items/:id */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const item = await purchaseService(req).updatePurchaseItems({ id: req.params.id, ...req.validatedBody } as Loose)
  res.json({ item })
}

/** DELETE /admin/purchase-items/:id — soft delete; order lines keep their own copy. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await purchaseService(req).softDeletePurchaseItems([req.params.id])
  res.json({ id: req.params.id, object: "purchase_item", deleted: true })
}
