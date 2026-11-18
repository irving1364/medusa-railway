import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { computeTotals, lineAmount, type QuoteLine } from "../../../../modules/quote/service"
import { effectiveStatus, identityFor, quoteService, type Loose } from "../../../admin/quotes/helpers"

/** Finds a quote by its private link token; drafts are never exposed. */
export async function quoteByToken(req: MedusaRequest): Promise<Loose> {
  const token = String(req.params.token || "")
  if (token.length < 16) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cotización no encontrada")
  const [quote] = await quoteService(req).listQuotes({ public_token: token }, { take: 1 })
  if (!quote || quote.status === "draft") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cotización no encontrada")
  return quote
}

/** What the customer sees: no internal notes, no ids. */
export async function publicQuote(req: MedusaRequest, quote: Loose) {
  const profile = await identityFor(req, quote.store)
  const lines = (quote.lines || []) as QuoteLine[]
  const status = effectiveStatus(quote)
  return {
    number: quote.number,
    version: Number(quote.version) || 1,
    status,
    can_respond: status === "sent",
    customer_name: quote.customer_name,
    contact_name: quote.contact_name,
    customer_ruc: quote.customer_ruc,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until,
    intro_text: quote.intro_text,
    lines: lines.map((l) => ({ ref: l.ref, title: l.title, description: l.description, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price, discount_pct: l.discount_pct, tax_rate: l.tax_rate, amount: lineAmount(l) })),
    totals: computeTotals(lines),
    warranty_text: quote.warranty_text,
    payment_terms: quote.payment_terms,
    general_terms: quote.general_terms,
    response: quote.responded_at ? { at: quote.responded_at, name: quote.response_name, comment: quote.response_comment } : null,
    company: {
      name: profile.company?.name || profile.brand_line,
      brand_line: profile.brand_line,
      legal_name: profile.company_name || profile.legal_name,
      ruc: profile.ruc,
      address: profile.address,
      email: profile.email,
      whatsapp: profile.whatsapp,
      website: profile.website,
      logo_url: profile.logo_url,
      color: profile.company?.color || null,
      bank: profile.bank_account_number ? { name: profile.bank_name, holder: profile.bank_holder, type: profile.bank_account_type, number: profile.bank_account_number } : null,
    },
  }
}

/** GET /store/quotes/:token — public view of a sent quote; records the first and following views. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const quote = await quoteByToken(req)
  if (req.query.track !== "0") {
    const service = quoteService(req)
    const first = !quote.viewed_at
    await service.updateQuotes({ id: quote.id, viewed_at: quote.viewed_at || new Date(), view_count: (Number(quote.view_count) || 0) + 1 } as Loose)
    if (first) await service.createQuoteRevisions({ quote_id: quote.id, version: Number(quote.version) || 1, action: "viewed", snapshot: {}, note: "El cliente abrió la cotización en línea" } as Loose)
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ quote: await publicQuote(req, quote) })
}
