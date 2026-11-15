import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { QuoteStore } from "../../../../../modules/quote/service"
import { actorEmail, quoteService, serialize, type Loose } from "../../helpers"

/** POST /admin/quotes/:id/duplicate — new draft with the next number, same customer, lines and texts. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = quoteService(req)
  const src = await service.retrieveQuote(req.params.id)
  const profile = await service.profileFor(src.store as QuoteStore)
  const { id: _id, number: _n, status: _s, version: _v, sent_at: _sa, approved_at: _aa, rejected_at: _ra, last_pdf_url: _p, order_id: _o, created_at: _c, updated_at: _u, deleted_at: _d, ...rest } = src as Loose
  const issue_date = new Date()
  const quote = await service.createQuotes({
    ...rest,
    number: await service.nextNumber(src.store as QuoteStore),
    status: "draft",
    version: 1,
    issue_date,
    valid_until: new Date(issue_date.getTime() + (Number(profile.validity_days) || 30) * 86400000),
    metadata: { ...(rest.metadata || {}), duplicated_from: src.number },
  } as Loose)
  await service.createQuoteRevisions({ quote_id: quote.id, version: 1, action: "created", snapshot: quote as Loose, note: `Duplicada de ${src.number}`, actor_email: await actorEmail(req) } as Loose)
  res.status(201).json({ quote: serialize(quote) })
}
