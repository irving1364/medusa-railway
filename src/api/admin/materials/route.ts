import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG_MODULE } from "../../../modules/catalog"
import type CatalogModuleService from "../../../modules/catalog/service"

type Loose = Record<string, any>

/** GET /admin/materials — every material (active first, then by order and name). `?active=1` returns only active ones. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  const filters: Loose = {}
  if (req.query.active === "1" || req.query.active === "true") filters.active = true
  const materials = await service.listMaterials(filters, { order: { active: "DESC", sort_order: "ASC", name: "ASC" } })
  res.json({ materials })
}

/** POST /admin/materials — creates a material. Names are unique (case-insensitive) among non-deleted rows. */
export async function POST(req: AuthenticatedMedusaRequest<{ name: string; active?: boolean; sort_order?: number }>, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  const body = req.validatedBody
  const existing = await service.listMaterials({ name: { $ilike: body.name } })
  if (existing.length) {
    res.status(400).json({ type: "invalid_data", message: `Ya existe el material "${existing[0].name}"` })
    return
  }
  const all = await service.listMaterials({}, { select: ["sort_order"] })
  const sort_order = body.sort_order ?? (all.reduce((m, r) => Math.max(m, r.sort_order || 0), 0) + 10)
  const material = await service.createMaterials({ name: body.name, active: body.active ?? true, sort_order } as Loose)
  res.status(201).json({ material })
}
