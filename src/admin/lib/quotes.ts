import type { HttpTypes } from "@medusajs/framework/types"
import { sdk } from "./sdk"

export type QuoteStore = "fabmetal" | "karven"
export type QuoteStatus = "draft" | "sent" | "approved" | "rejected"
export type EffectiveStatus = QuoteStatus | "expired"

export interface QuoteLine {
  id: string
  ref: string | null
  title: string
  description: string | null
  quantity: number
  unit: string
  unit_price: number
  discount_pct: number
  tax_rate: number
  product_id: string | null
  variant_id: string | null
}

export interface Quote {
  id: string
  number: string
  store: QuoteStore
  status: QuoteStatus
  effective_status: EffectiveStatus
  version: number
  customer_id: string | null
  customer_name: string
  customer_company: string | null
  customer_ruc: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  contact_name: string | null
  issue_date: string
  valid_until: string | null
  salesperson: string | null
  currency: string
  lines: QuoteLine[]
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  intro_text: string | null
  warranty_text: string | null
  payment_terms: string | null
  general_terms: string | null
  notes_internal: string | null
  order_id: string | null
  sent_at: string | null
  approved_at: string | null
  rejected_at: string | null
  last_pdf_url: string | null
  created_at: string
  updated_at: string
}

export interface QuoteProfile {
  id: string
  store: QuoteStore
  brand_line: string
  company_name: string
  tagline: string | null
  ruc: string | null
  address: string | null
  website: string | null
  email: string | null
  whatsapp: string | null
  logo_url: string | null
  bank_name: string | null
  bank_holder: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  warranty_text: string | null
  payment_terms: string | null
  general_terms: string | null
  number_prefix: string
  next_number: number
  validity_days: number
  tax_rate: number
  from_email: string | null
  cc_email: string | null
  email_signature: string | null
}

export interface Revision { id: string; version: number; action: string; pdf_url: string | null; sent_to: string | null; note: string | null; actor_email: string | null; total: number | null; created_at: string }

/** Editable fields (dates as YYYY-MM-DD). */
export interface QuoteInput {
  store: QuoteStore
  customer_id: string | null
  customer_name: string
  customer_company: string
  customer_ruc: string
  customer_email: string
  customer_phone: string
  customer_address: string
  contact_name: string
  issue_date: string
  valid_until: string
  salesperson: string
  lines: QuoteLine[]
  intro_text: string
  warranty_text: string
  payment_terms: string
  general_terms: string
  notes_internal: string
}

export const STORES: { value: QuoteStore; label: string }[] = [
  { value: "fabmetal", label: "FABMETAL" },
  { value: "karven", label: "KARVEN Medical" },
]
export const storeLabel = (s: string) => STORES.find((x) => x.value === s)?.label || s

export const STATUS: Record<EffectiveStatus, { label: string; color: "grey" | "blue" | "green" | "red" | "orange" }> = {
  draft: { label: "Borrador", color: "grey" },
  sent: { label: "Enviada", color: "blue" },
  approved: { label: "Aprobada", color: "green" },
  rejected: { label: "Rechazada", color: "red" },
  expired: { label: "Vencida", color: "orange" },
}

export const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const addDaysISO = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const toISODate = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "")

export const newLine = (partial: Partial<QuoteLine> = {}): QuoteLine => ({
  id: `l_${Math.random().toString(36).slice(2, 10)}`, ref: null, title: "", description: null, quantity: 1, unit: "Unidades", unit_price: 0, discount_pct: 0, tax_rate: 7, product_id: null, variant_id: null, ...partial,
})

export const emptyQuote = (store: QuoteStore, profile?: QuoteProfile | null): QuoteInput => {
  const issue = todayISO()
  return {
    store, customer_id: null, customer_name: "", customer_company: "", customer_ruc: "", customer_email: "", customer_phone: "", customer_address: "", contact_name: "",
    issue_date: issue, valid_until: addDaysISO(issue, profile?.validity_days || 30), salesperson: "", lines: [],
    intro_text: "", warranty_text: profile?.warranty_text || "", payment_terms: profile?.payment_terms || "", general_terms: profile?.general_terms || "", notes_internal: "",
  }
}

export const toInput = (q: Quote): QuoteInput => ({
  store: q.store, customer_id: q.customer_id, customer_name: q.customer_name || "", customer_company: q.customer_company || "", customer_ruc: q.customer_ruc || "",
  customer_email: q.customer_email || "", customer_phone: q.customer_phone || "", customer_address: q.customer_address || "", contact_name: q.contact_name || "",
  issue_date: toISODate(q.issue_date), valid_until: toISODate(q.valid_until), salesperson: q.salesperson || "", lines: q.lines || [],
  intro_text: q.intro_text || "", warranty_text: q.warranty_text || "", payment_terms: q.payment_terms || "", general_terms: q.general_terms || "", notes_internal: q.notes_internal || "",
})

export const toBody = (f: QuoteInput) => ({
  ...f,
  customer_id: f.customer_id || null,
  valid_until: f.valid_until || null,
  lines: f.lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0, discount_pct: Number(l.discount_pct) || 0, tax_rate: Number(l.tax_rate) || 0 })),
})

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const lineAmount = (l: QuoteLine) => round((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_pct) || 0) / 100))
export const totalsOf = (lines: QuoteLine[]) => {
  let gross = 0, subtotal = 0, tax = 0
  for (const l of lines) { const base = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0); const net = base * (1 - (Number(l.discount_pct) || 0) / 100); gross += base; subtotal += net; tax += net * ((Number(l.tax_rate) || 0) / 100) }
  return { subtotal: round(subtotal), discount_total: round(gross - subtotal), tax_total: round(tax), total: round(subtotal + tax) }
}

export const money = (n: number) => `$ ${new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`
export const fmtDate = (iso: string | null | undefined, withTime = false) => (iso ? new Intl.DateTimeFormat("es-PA", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(iso)) : "—")

/* ─── API ──────────────────────────────────────────────────────────────────── */

const api = <T,>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}) =>
  sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body, query: init.query })

export const listQuotes = (query: Record<string, string | number | undefined>) => api<{ quotes: Quote[]; count: number }>("/admin/quotes", { query })
export const getQuote = (id: string) => api<{ quote: Quote }>(`/admin/quotes/${id}`)
export const createQuote = (body: ReturnType<typeof toBody>) => api<{ quote: Quote }>("/admin/quotes", { method: "POST", body })
export const updateQuote = (id: string, body: Partial<ReturnType<typeof toBody>>) => api<{ quote: Quote }>(`/admin/quotes/${id}`, { method: "POST", body })
export const deleteQuote = (id: string) => api<{ id: string }>(`/admin/quotes/${id}`, { method: "DELETE" })
export const setQuoteStatus = (id: string, status: QuoteStatus, note?: string) => api<{ quote: Quote }>(`/admin/quotes/${id}/status`, { method: "POST", body: { status, note: note || null } })
export const sendQuote = (id: string, body: { to: string[]; cc?: string[]; subject: string; message: string }) => api<{ quote: Quote; pdf_url: string | null }>(`/admin/quotes/${id}/send`, { method: "POST", body })
export const duplicateQuote = (id: string) => api<{ quote: Quote }>(`/admin/quotes/${id}/duplicate`, { method: "POST" })
export const listRevisions = (id: string) => api<{ revisions: Revision[] }>(`/admin/quotes/${id}/revisions`)
export const quotePdfUrl = (id: string, download = false) => `/admin/quotes/${id}/pdf${download ? "?download=1" : ""}`
export const listProfiles = () => api<{ profiles: QuoteProfile[] }>("/admin/quote-profiles")
export const updateProfile = (store: QuoteStore, body: Partial<QuoteProfile>) => api<{ profile: QuoteProfile }>(`/admin/quote-profiles/${store}`, { method: "POST", body })

/** Catalogue search for the line picker: products with variants and PAB prices. */
export const searchProducts = async (q: string) => {
  const { products } = await sdk.admin.product.list({ q, limit: 12, status: "published", fields: "id,title,handle,description,material,metadata,thumbnail,*variants,*variants.prices" } as HttpTypes.AdminProductListParams)
  return products || []
}
export const searchCustomers = async (q: string) => {
  const { customers } = await sdk.admin.customer.list({ q, limit: 10 } as HttpTypes.AdminCustomerFilters)
  return customers || []
}

/** Line prefilled from a catalogue product/variant: ref = SKU, description = product description + dimensions. */
export const lineFromProduct = (p: HttpTypes.AdminProduct, v: HttpTypes.AdminProductVariant | undefined, taxRate: number): QuoteLine => {
  const meta = (p.metadata || {}) as Record<string, unknown>
  const price = (v?.prices || []).find((pr) => pr.currency_code === "pab")?.amount ?? (v?.prices || [])[0]?.amount ?? 0
  const dims = typeof meta.dimensions === "string" && meta.dimensions ? `Medidas: ${meta.dimensions}.` : ""
  const material = p.material || (typeof meta.material === "string" ? meta.material : "")
  const titleLine = material ? `${p.title} en ${material}` : p.title
  const description = [titleLine, p.description || "", dims].filter(Boolean).join("\n\n")
  return newLine({ ref: v?.sku || null, title: p.title + (v && v.title && !/^(est[aá]ndar|default)/i.test(v.title) ? ` · ${v.title}` : ""), description, unit_price: Number(price) || 0, tax_rate: taxRate, product_id: p.id, variant_id: v?.id || null })
}

export const errorMessage = (e: unknown, fallback: string) => {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message
  return fallback
}
