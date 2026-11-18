import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { renderQuotePdf } from "../../../../../modules/quote/pdf"
import { identityFor } from "../../../../admin/quotes/helpers"
import { quoteByToken } from "../route"

/** GET /store/quotes/:token/pdf — the quote PDF for the customer (current version). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const quote = await quoteByToken(req)
  const pdf = await renderQuotePdf(quote, await identityFor(req, quote.store))
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="Cotizacion-${quote.number}.pdf"`)
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
