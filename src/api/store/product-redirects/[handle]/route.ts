import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG_MODULE } from "../../../../modules/catalog"
import type CatalogModuleService from "../../../../modules/catalog/service"

/** GET /store/product-redirects/:handle — where an old product URL now lives (404 when there is no redirect). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(CATALOG_MODULE) as CatalogModuleService
  const [redirect] = await service.listProductRedirects({ from_handle: req.params.handle }, { take: 1 })
  if (!redirect) {
    res.status(404).json({ type: "not_found", message: "No redirect" })
    return
  }
  res.json({ from_handle: redirect.from_handle, to_handle: redirect.to_handle })
}
