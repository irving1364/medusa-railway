import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const PREVIEW_SECRET = process.env.PROJECT_PREVIEW_SECRET || ""

/**
 * GET /store/product-preview/:handle?preview=<secret> — a product in ANY status (drafts included) for the
 * "Vista previa en la web" button of the admin. Prices are flattened to `calculated_price` in PAB so the
 * storefront can map it like a regular Store API product. Requires the shared preview secret.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = typeof req.query.preview === "string" ? req.query.preview : ""
  if (!PREVIEW_SECRET || token !== PREVIEW_SECRET) {
    res.status(404).json({ type: "not_found", message: "Not found" })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["*", "images.*", "categories.*", "collection.*", "options.*", "options.values.*", "variants.*", "variants.prices.*"],
    filters: { handle: req.params.handle },
  })
  const product = (data as Record<string, any>[])[0]
  if (!product) {
    res.status(404).json({ type: "not_found", message: "Producto no encontrado" })
    return
  }
  product.variants = (product.variants || []).map((v: Record<string, any>) => {
    const price = (v.prices || []).find((p: { currency_code: string }) => p.currency_code === "pab") || (v.prices || [])[0]
    return { ...v, calculated_price: price ? { calculated_amount: price.amount, currency_code: price.currency_code } : null }
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ product, preview: true })
}
