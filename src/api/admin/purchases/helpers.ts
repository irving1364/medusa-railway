import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../modules/company"
import type CompanyModuleService from "../../../modules/company/service"
import { PURCHASE_MODULE } from "../../../modules/purchase"
import type PurchaseModuleService from "../../../modules/purchase/service"
import { computeTotals, type PurchaseLine } from "../../../modules/purchase/service"

export type Loose = Record<string, any>

export const purchaseService = (req: { scope: any }) => req.scope.resolve(PURCHASE_MODULE) as PurchaseModuleService

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

/** Company identity for the PDF/email + purchasing profile (numbering, ship-to, terms). */
export async function identityFor(req: { scope: any }, company: string): Promise<Loose> {
  const service = purchaseService(req)
  const profile = await service.profileFor(company as "fabmetal" | "karven")
  try {
    const companies = req.scope.resolve(COMPANY_MODULE) as CompanyModuleService
    const c = await companies.byCode(company)
    return c ? { ...profile, company: c, brand_line: c.brand_line, legal_name: c.legal_name, tagline: c.tagline, ruc: c.ruc, address: c.address, website: c.website, email: c.email, whatsapp: c.whatsapp, logo_url: c.logo_url, from_email: c.from_email, cc_email: c.cc_email } : profile
  } catch {
    return profile
  }
}

export const normaliseLines = (input: Loose[] | undefined, previous: PurchaseLine[] = []): PurchaseLine[] =>
  (input || []).map((l, i) => ({
    id: String(l.id || `l${i + 1}`),
    item_id: l.item_id ? String(l.item_id) : null,
    ref: l.ref ? String(l.ref) : null,
    title: String(l.title || "").trim(),
    description: l.description ? String(l.description) : null,
    quantity: Number(l.quantity) || 0,
    unit: String(l.unit || "Unidades"),
    unit_price: Number(l.unit_price) || 0,
    discount_pct: Number(l.discount_pct) || 0,
    tax_rate: Number(l.tax_rate ?? 7),
    // received quantities are only changed through receipts
    received_qty: Number(previous.find((p) => p.id === String(l.id))?.received_qty ?? l.received_qty ?? 0) || 0,
  }))

const toDate = (v: unknown): Date | null => {
  if (!v) return null
  const s = String(v)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export const bodyToRow = (body: Loose, previousLines: PurchaseLine[] = []): Loose => {
  const row: Loose = {}
  for (const k of ["company", "supplier_id", "supplier_name", "supplier_ruc", "supplier_contact", "supplier_phone", "supplier_email", "supplier_address", "ship_to_name", "ship_to_address", "ship_to_phone", "payment_terms", "notes_internal", "invoice_reference", "metadata"]) {
    if (k in body) row[k] = body[k] === "" ? null : body[k]
  }
  if ("order_date" in body) row.order_date = toDate(body.order_date) || new Date()
  if ("expected_date" in body) row.expected_date = toDate(body.expected_date)
  if ("lines" in body) { const lines = normaliseLines(body.lines, previousLines); row.lines = lines; Object.assign(row, computeTotals(lines)) }
  return row
}

export const serialize = (o: Loose) => ({
  ...o,
  subtotal: Number(o.subtotal) || 0, discount_total: Number(o.discount_total) || 0, tax_total: Number(o.tax_total) || 0, total: Number(o.total) || 0, paid_total: Number(o.paid_total) || 0,
  balance: Math.round(((Number(o.total) || 0) - (Number(o.paid_total) || 0)) * 100) / 100,
})

export const fmtMoney = (n: number) => { const v = Math.round((Number(n) || 0) * 100) / 100; const [i, f = ""] = Math.abs(v).toFixed(2).split("."); return `${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f} B/.` }
export const fmtDate = (d: string | Date | null | undefined) => { if (!d) return ""; const t = new Date(new Date(d).getTime() - 5 * 3600000); return `${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${t.getUTCFullYear()}` }

export async function logEvent(req: AuthenticatedMedusaRequest, order_id: string, action: string, note: string | null = null, data: Loose | null = null) {
  await purchaseService(req).createPurchaseEvents({ order_id, action, note, data, actor_email: await actorEmail(req) } as Loose)
}
