import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG_MODULE } from "../../../modules/catalog"
import type CatalogModuleService from "../../../modules/catalog/service"

/** GET /admin/product-redirects?product_id= — redirects pointing at a product (shown in the form as "URLs anteriores"). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  const filters: Record<string, unknown> = {}
  if (typeof req.query.product_id === "string") filters.product_id = req.query.product_id
  if (typeof req.query.to_handle === "string") filters.to_handle = req.query.to_handle
  const redirects = await service.listProductRedirects(filters, { order: { created_at: "DESC" } })
  res.json({ redirects })
}

/** POST /admin/product-redirects — records that the old URL of a product now lives at the new handle. */
export async function POST(req: AuthenticatedMedusaRequest<{ from_handle: string; to_handle: string; product_id?: string | null }>, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  const { from_handle, to_handle, product_id } = req.validatedBody
  await service.pointRedirect(from_handle, to_handle, product_id || null)
  const redirects = await service.listProductRedirects({ to_handle })
  res.status(201).json({ redirects })
}
