import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../modules/company"
import type CompanyModuleService from "../../../modules/company/service"
import { QUOTE_MODULE } from "../../../modules/quote"
import type QuoteModuleService from "../../../modules/quote/service"
import { computeTotals, type QuoteLine } from "../../../modules/quote/service"

export type Loose = Record<string, any>

export const quoteService = (req: { scope: any }) => req.scope.resolve(QUOTE_MODULE) as QuoteModuleService

/**
 * Settings used to render and send a quote: the company's identity (brand, legal data, bank, sender) merged over the
 * quote profile (numbering, validity, tax, default texts). Company fields win when present.
 */
export async function identityFor(req: { scope: any }, store: string): Promise<Loose> {
  const service = quoteService(req)
  const profile = await service.profileFor(store as "fabmetal" | "karven")
  try {
    const companies = req.scope.resolve(COMPANY_MODULE) as CompanyModuleService
    const company = await companies.byCode(store)
    if (!company) return profile
    const merged: Loose = { ...profile }
    for (const k of ["brand_line", "tagline", "ruc", "address", "website", "email", "whatsapp", "logo_url", "bank_name", "bank_holder", "bank_account_type", "bank_account_number", "from_email", "cc_email"]) {
      if (company[k] !== null && company[k] !== undefined && company[k] !== "") merged[k] = company[k]
    }
    merged.company_name = company.legal_name || profile.company_name
    merged.company = company
    return merged
  } catch {
    return profile
  }
}

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

/** Numeric columns come back from Postgres as strings; the admin and emails expect numbers. */
export const serialize = (q: Loose) => ({ ...q, portal_url: portalUrl(q.public_token), view_count: Number(q.view_count) || 0, subtotal: Number(q.subtotal) || 0, discount_total: Number(q.discount_total) || 0, tax_total: Number(q.tax_total) || 0, total: Number(q.total) || 0, version: Number(q.version) || 1, effective_status: effectiveStatus(q), totals: computeTotals((q.lines || []) as QuoteLine[]) })

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

export const fmtMoney = (n: number) => { const v = Math.round((Number(n) || 0) * 100) / 100; const [i, f = ""] = Math.abs(v).toFixed(2).split("."); return `$ ${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f}` }
export const fmtDate = (d: string | Date | null | undefined) => { if (!d) return ""; const t = new Date(new Date(d).getTime() - 5 * 3600000); return `${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${t.getUTCFullYear()}` }

/* ─── Customer portal ─────────────────────────────────────────────────────── */

export const STOREFRONT_URL = (process.env.STOREFRONT_URL || "https://karvenmedical.com").replace(/\/$/, "")
export const portalUrl = (token: string | null | undefined) => (token ? `${STOREFRONT_URL}/cotizacion/${token}` : null)

/** Gives the quote a private, unguessable link token (once). */
export async function ensurePortalToken(req: { scope: any }, quote: Loose): Promise<Loose> {
  if (quote.public_token) return quote
  const { randomBytes } = await import("node:crypto")
  return quoteService(req).updateQuotes({ id: quote.id, public_token: randomBytes(18).toString("base64url") } as Loose)
}

/** Internal email to the company (its public email + cc list) when a customer answers from the portal. */
export async function notifyCompany(profile: Loose, subject: string, lines: string[]): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const to = [profile.email, ...(profile.cc_email ? String(profile.cc_email).split(/[,;]\s*/) : []), process.env.STORE_NOTIFICATION_EMAIL || "karvenmedicalpa@gmail.com"].filter(Boolean) as string[]
  const { Resend } = await import("resend")
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: profile.from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: [...new Set(to)],
      subject,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1F2430">${lines.map((l) => `<p style="margin:0 0 10px">${esc(l).replace(/\n/g, "<br>")}</p>`).join("")}</div>`,
    })
  } catch (e) {
    console.error("[quotes] notifyCompany failed", e)
  }
}
