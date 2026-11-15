import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { renderQuotePdf } from "../../../../../modules/quote/pdf"
import type { QuoteStore } from "../../../../../modules/quote/service"
import { quoteService } from "../../helpers"

/** GET /admin/quotes/:id/pdf — renders the current state of the quote as PDF (inline; `?download=1` forces a download). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = quoteService(req)
  const quote = await service.retrieveQuote(req.params.id)
  const profile = await service.profileFor(quote.store as QuoteStore)
  const pdf = await renderQuotePdf(quote, profile)
  const filename = `Cotizacion-${quote.number}${quote.version > 1 ? `-v${quote.version}` : ""}.pdf`
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${filename}"`)
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
