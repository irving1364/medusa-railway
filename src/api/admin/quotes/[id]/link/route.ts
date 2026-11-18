import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ensurePortalToken, quoteService, serialize } from "../../helpers"

/** POST /admin/quotes/:id/link — creates the customer link (to share by WhatsApp without emailing). Drafts are not shareable. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const quote = await quoteService(req).retrieveQuote(req.params.id)
  if (quote.status === "draft") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Marque la cotización como enviada para compartir el enlace")
  res.json({ quote: serialize(await ensurePortalToken(req, quote)) })
}
