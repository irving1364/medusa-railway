import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorEmail, bodyToRow, quoteService, serialize, type Loose } from "./helpers"
import type { QuoteStore } from "../../../modules/quote/service"

/** GET /admin/quotes?q=&store=&status=&limit=&offset= — newest first. `status=expired` filters sent quotes past validity. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = quoteService(req)
  const { q, store, status } = req.query as Record<string, string | undefined>
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const filters: Loose = {}
  if (store) filters.store = store
  if (status && status !== "expired") filters.status = status
  if (status === "expired") { filters.status = "sent"; filters.valid_until = { $lt: new Date() } }
  if (q) filters.$or = [{ customer_name: { $ilike: `%${q}%` } }, { number: { $ilike: `%${q}%` } }, { customer_company: { $ilike: `%${q}%` } }]
  const [quotes, count] = await service.listAndCountQuotes(filters, { take: limit, skip: offset, order: { created_at: "DESC" } })
  res.json({ quotes: quotes.map(serialize), count, limit, offset })
}

/** POST /admin/quotes — creates a draft with the next number of the store; empty texts fall back to the store profile. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = quoteService(req)
  const body = req.validatedBody
  const store = body.store as QuoteStore
  const profile = await service.profileFor(store)
  const row = bodyToRow(body)
  if (!row.issue_date) row.issue_date = new Date()
  if (!("valid_until" in row) || !row.valid_until) row.valid_until = new Date(row.issue_date.getTime() + (Number(profile.validity_days) || 30) * 86400000)
  for (const k of ["warranty_text", "payment_terms", "general_terms"]) if (row[k] === undefined || row[k] === null) row[k] = profile[k] || null
  if (!row.lines) { row.lines = []; row.subtotal = 0; row.discount_total = 0; row.tax_total = 0; row.total = 0 }
  if (!row.salesperson) row.salesperson = await actorEmail(req)
  row.number = await service.nextNumber(store)
  row.status = "draft"
  row.version = 1
  const quote = await service.createQuotes(row as Loose)
  await service.createQuoteRevisions({ quote_id: quote.id, version: 1, action: "created", snapshot: quote as Loose, actor_email: await actorEmail(req) } as Loose)
  res.status(201).json({ quote: serialize(quote) })
}
