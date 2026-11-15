import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STOREFRONT_URL } from "../../projects/helpers"

const PREVIEW_SECRET = process.env.PROJECT_PREVIEW_SECRET || ""

/** GET /admin/product-preview-url/:handle — storefront URL that shows a draft product (the secret never reaches the admin bundle). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ url: PREVIEW_SECRET ? `${STOREFRONT_URL}/mobiliario/${encodeURIComponent(req.params.handle)}?preview=${encodeURIComponent(PREVIEW_SECRET)}` : null })
}
