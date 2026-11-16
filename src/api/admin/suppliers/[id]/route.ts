import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { purchaseService, type Loose } from "../../purchases/helpers"

/** GET /admin/suppliers/:id */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ supplier: await purchaseService(req).retrieveSupplier(req.params.id) })
}

/** POST /admin/suppliers/:id */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const supplier = await purchaseService(req).updateSuppliers({ id: req.params.id, ...req.validatedBody } as Loose)
  res.json({ supplier })
}

/** DELETE /admin/suppliers/:id — soft delete (orders keep the snapshot of the supplier). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await purchaseService(req).softDeleteSuppliers([req.params.id])
  res.json({ id: req.params.id, object: "supplier", deleted: true })
}
