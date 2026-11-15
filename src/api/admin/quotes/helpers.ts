import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../modules/quote"
import type QuoteModuleService from "../../../modules/quote/service"
import { computeTotals, type QuoteLine } from "../../../modules/quote/service"

export type Loose = Record<string, any>

export const quoteService = (req: { scope: any }) => req.scope.resolve(QUOTE_MODULE) as QuoteModuleService

/** Who is acting, for revisions. */
export async function actorEmail(req: AuthenticatedMedusaRequest): Promise<string | null> {
  const actor_id = req.auth_context?.actor_id
  if (!actor_id) return null
  try {
    const users = req.scope.resolve(Modules.USER) as { retrieveUser: (id: string) => Promise<{ email?: string }> }
    return (await users.retrieveUser(actor_id))?.email || null
  } catch {
    return null
  }
}

/** Normalises line input (ids, numbers) and recomputes totals. */
export const normaliseLines = (input: Loose[] | undefined): QuoteLine[] =>
  (input || []).map((l, i) => ({
    id: String(l.id || `l${i + 1}`),
    ref: l.ref ? String(l.ref) : null,
    title: String(l.title || "").trim(),
    description: l.description ? String(l.description) : null,
    quantity: Number(l.quantity) || 0,
    unit: String(l.unit || "Unidades"),
    unit_price: Number(l.unit_price) || 0,
    discount_pct: Number(l.discount_pct) || 0,
    tax_rate: Number(l.tax_rate ?? 7),
    product_id: l.product_id ? String(l.product_id) : null,
    variant_id: l.variant_id ? String(l.variant_id) : null,
  }))

/** "sent" quotes past their validity read as "expired" everywhere (list, PDF banner, emails). */
export const effectiveStatus = (q: Loose): string => {
  if (q.status === "sent" && q.valid_until && new Date(q.valid_until).getTime() < Date.now()) return "expired"
  return q.status
}

export const serialize = (q: Loose) => ({ ...q, effective_status: effectiveStatus(q), totals: computeTotals((q.lines || []) as QuoteLine[]) })

const toDate = (v: unknown): Date | null => {
  if (!v) return null
  const s = String(v)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Body → row fields shared by create and update. */
export const bodyToRow = (body: Loose): Loose => {
  const row: Loose = {}
  for (const k of ["store", "customer_id", "customer_name", "customer_company", "customer_ruc", "customer_email", "customer_phone", "customer_address", "contact_name", "salesperson", "intro_text", "warranty_text", "payment_terms", "general_terms", "notes_internal", "metadata"]) {
    if (k in body) row[k] = body[k] === "" ? null : body[k]
  }
  if ("issue_date" in body) row.issue_date = toDate(body.issue_date) || new Date()
  if ("valid_until" in body) row.valid_until = toDate(body.valid_until)
  if ("lines" in body) {
    const lines = normaliseLines(body.lines)
    row.lines = lines
    Object.assign(row, computeTotals(lines))
  }
  return row
}

export const fmtMoney = (n: number) => `$ ${new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Intl.DateTimeFormat("es-PA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Panama" }).format(new Date(d)) : "")
