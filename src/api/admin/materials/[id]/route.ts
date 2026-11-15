import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG_MODULE } from "../../../../modules/catalog"
import type CatalogModuleService from "../../../../modules/catalog/service"

type Loose = Record<string, any>

/** POST /admin/materials/:id — rename, reorder or enable/disable a material. */
export async function POST(req: AuthenticatedMedusaRequest<{ name?: string; active?: boolean; sort_order?: number }>, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  const body = req.validatedBody
  if (body.name) {
    const clash = await service.listMaterials({ name: { $ilike: body.name } })
    if (clash.some((m) => m.id !== req.params.id)) {
      res.status(400).json({ type: "invalid_data", message: `Ya existe el material "${body.name}"` })
      return
    }
  }
  const material = await service.updateMaterials({ id: req.params.id, ...body } as Loose)
  res.json({ material })
}

/** DELETE /admin/materials/:id — removes a material from the list (products keep the name they already have). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  await service.softDeleteMaterials([req.params.id])
  res.json({ id: req.params.id, object: "material", deleted: true })
}
