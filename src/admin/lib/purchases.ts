import { sdk } from "./sdk"
import type { CompanyCode } from "./companies"

export type PurchaseStatus = "draft" | "sent" | "confirmed" | "partial" | "received" | "cancelled"

export interface Supplier { id: string; name: string; ruc: string | null; dv: string | null; contact_name: string | null; phone: string | null; email: string | null; address: string | null; payment_terms: string | null; notes: string | null; active: boolean; created_at: string }
export interface PurchaseItem { id: string; ref: string | null; name: string; description: string | null; unit: string; category: string | null; last_price: number | null; last_supplier_id: string | null; last_supplier_name: string | null; last_bought_at: string | null; active: boolean; stock: number | string; min_stock: number | string | null }
export interface PurchaseLine { id: string; item_id: string | null; ref: string | null; title: string; description: string | null; quantity: number; unit: string; unit_price: number; discount_pct: number; tax_rate: number; received_qty: number }
export interface Receipt { id: string; received_at: string; reference: string | null; lines: { line_id: string; quantity: number }[]; note: string | null; actor_email: string | null }
export interface Payment { id: string; paid_at: string; amount: number; method: string | null; reference: string | null; note: string | null; actor_email: string | null }
export interface PurchaseEvent { id: string; action: string; note: string | null; data: Record<string, unknown> | null; actor_email: string | null; created_at: string }

export interface PurchaseOrder {
  id: string; number: string; company: CompanyCode; status: PurchaseStatus
  supplier_id: string | null; supplier_name: string; supplier_ruc: string | null; supplier_contact: string | null; supplier_phone: string | null; supplier_email: string | null; supplier_address: string | null
  ship_to_name: string | null; ship_to_address: string | null; ship_to_phone: string | null
  order_date: string; expected_date: string | null; payment_terms: string | null; currency: string
  lines: PurchaseLine[]; subtotal: number; discount_total: number; tax_total: number; total: number; paid_total: number; balance: number
  notes_internal: string | null; invoice_reference: string | null
  sent_at: string | null; confirmed_at: string | null; received_at: string | null; cancelled_at: string | null; last_pdf_url: string | null
  created_at: string; updated_at: string
  metadata?: Record<string, unknown> | null
}
export interface PurchaseProfile { id: string; company: CompanyCode; number_prefix: string; next_number: number; ship_to_name: string | null; ship_to_address: string | null; ship_to_phone: string | null; payment_terms: string | null; tax_rate: number; email_signature: string | null }

export interface PurchaseInput {
  company: CompanyCode
  supplier_id: string | null; supplier_name: string; supplier_ruc: string; supplier_contact: string; supplier_phone: string; supplier_email: string; supplier_address: string
  ship_to_name: string; ship_to_address: string; ship_to_phone: string
  order_date: string; expected_date: string; payment_terms: string
  lines: PurchaseLine[]
  notes_internal: string; invoice_reference: string
}
export interface SupplierInput { name: string; ruc: string; dv: string; contact_name: string; phone: string; email: string; address: string; payment_terms: string; notes: string }
export interface ItemInput { name: string; ref: string; description: string; unit: string; category: string; last_price: string; min_stock: string }

export const STATUS: Record<PurchaseStatus, { label: string; color: "grey" | "blue" | "green" | "orange" | "red" | "purple" }> = {
  draft: { label: "Borrador", color: "grey" }, sent: { label: "Enviada", color: "blue" }, confirmed: { label: "Confirmada", color: "purple" },
  partial: { label: "Recibida parcial", color: "orange" }, received: { label: "Recibida", color: "green" }, cancelled: { label: "Cancelada", color: "red" },
}
export const UNITS = ["Unidades", "Láminas", "Tubos", "Metros", "Kilogramos", "Litros", "Galones", "Cajas", "Juegos", "Servicio"]
export const CATEGORIES = ["Lámina inoxidable", "Lámina acero al carbono", "Tubo y perfil", "Soldadura y consumibles", "Pintura y acabados", "Herrajes y accesorios", "Tapicería", "Servicios externos", "Otro"]
export const PAYMENT_METHODS = ["Transferencia", "ACH", "Cheque", "Efectivo", "Tarjeta", "Yappy", "Otro"]

export const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const toISODate = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "")
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const lineAmount = (l: PurchaseLine) => round((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_pct) || 0) / 100))
export const totalsOf = (lines: PurchaseLine[]) => { let gross = 0, subtotal = 0, tax = 0; for (const l of lines) { const base = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0); const net = base * (1 - (Number(l.discount_pct) || 0) / 100); gross += base; subtotal += net; tax += net * ((Number(l.tax_rate) || 0) / 100) }; return { subtotal: round(subtotal), discount_total: round(gross - subtotal), tax_total: round(tax), total: round(subtotal + tax) } }
export const money = (n: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} B/.`
export const fmtDate = (iso: string | null | undefined, withTime = false) => (iso ? new Intl.DateTimeFormat("es-PA", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(iso)) : "—")

export const newLine = (partial: Partial<PurchaseLine> = {}): PurchaseLine => ({ id: `l_${Math.random().toString(36).slice(2, 10)}`, item_id: null, ref: null, title: "", description: null, quantity: 1, unit: "Unidades", unit_price: 0, discount_pct: 0, tax_rate: 7, received_qty: 0, ...partial })
export const lineFromItem = (it: PurchaseItem, taxRate: number): PurchaseLine => newLine({ item_id: it.id, ref: it.ref, title: it.name, description: it.description, unit: it.unit || "Unidades", unit_price: Number(it.last_price) || 0, tax_rate: taxRate })

export const emptyOrder = (company: CompanyCode, profile?: PurchaseProfile | null): PurchaseInput => ({
  company, supplier_id: null, supplier_name: "", supplier_ruc: "", supplier_contact: "", supplier_phone: "", supplier_email: "", supplier_address: "",
  ship_to_name: profile?.ship_to_name || "", ship_to_address: profile?.ship_to_address || "", ship_to_phone: profile?.ship_to_phone || "",
  order_date: todayISO(), expected_date: "", payment_terms: profile?.payment_terms || "", lines: [], notes_internal: "", invoice_reference: "",
})
export const emptySupplier = (): SupplierInput => ({ name: "", ruc: "", dv: "", contact_name: "", phone: "", email: "", address: "", payment_terms: "", notes: "" })
export const emptyItem = (): ItemInput => ({ name: "", ref: "", description: "", unit: "Unidades", category: "", last_price: "", min_stock: "" })

export const toInput = (o: PurchaseOrder): PurchaseInput => ({
  company: o.company, supplier_id: o.supplier_id, supplier_name: o.supplier_name || "", supplier_ruc: o.supplier_ruc || "", supplier_contact: o.supplier_contact || "", supplier_phone: o.supplier_phone || "", supplier_email: o.supplier_email || "", supplier_address: o.supplier_address || "",
  ship_to_name: o.ship_to_name || "", ship_to_address: o.ship_to_address || "", ship_to_phone: o.ship_to_phone || "",
  order_date: toISODate(o.order_date), expected_date: toISODate(o.expected_date), payment_terms: o.payment_terms || "",
  lines: o.lines || [], notes_internal: o.notes_internal || "", invoice_reference: o.invoice_reference || "",
})

/** Empty lines (no name, no price) are dropped on save; a line with data but no name blocks saving with a clear message. */
export const isBlankLine = (l: PurchaseLine) => !String(l.title || "").trim() && !(Number(l.unit_price) > 0) && !String(l.description || "").trim()
export const lineProblem = (lines: PurchaseLine[]): string | null => {
  const i = lines.findIndex((l) => !isBlankLine(l) && !String(l.title || "").trim())
  return i >= 0 ? `La línea ${i + 1} no tiene nombre de producto o servicio. Escríbalo o quite la línea.` : null
}

export const toBody = (f: PurchaseInput) => ({ ...f, supplier_id: f.supplier_id || null, expected_date: f.expected_date || null, lines: f.lines.filter((l) => !isBlankLine(l)).map((l) => ({ ...l, title: l.title.trim(), quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0, discount_pct: Number(l.discount_pct) || 0, tax_rate: Number(l.tax_rate) || 0 })) })
export const supplierToInput = (s: Supplier): SupplierInput => ({ name: s.name || "", ruc: s.ruc || "", dv: s.dv || "", contact_name: s.contact_name || "", phone: s.phone || "", email: s.email || "", address: s.address || "", payment_terms: s.payment_terms || "", notes: s.notes || "" })
export const supplierFields = (s: Supplier) => ({ supplier_id: s.id, supplier_name: s.name, supplier_ruc: s.ruc ? `${s.ruc}${s.dv ? ` DV ${s.dv}` : ""}` : "", supplier_contact: s.contact_name || "", supplier_phone: s.phone || "", supplier_email: s.email || "", supplier_address: s.address || "" })
export const itemToInput = (it: PurchaseItem): ItemInput => ({ name: it.name, ref: it.ref || "", description: it.description || "", unit: it.unit || "Unidades", category: it.category || "", last_price: it.last_price != null ? String(it.last_price) : "", min_stock: it.min_stock != null ? String(Number(it.min_stock)) : "" })

/* ─── API ──────────────────────────────────────────────────────────────────── */
const api = <T,>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}) => sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body, query: init.query })

export const listOrders = (query: Record<string, string | number | undefined>) => api<{ orders: PurchaseOrder[]; count: number }>("/admin/purchase-orders", { query })
export const getOrder = (id: string) => api<{ order: PurchaseOrder; receipts: Receipt[]; payments: Payment[]; events: PurchaseEvent[] }>(`/admin/purchase-orders/${id}`)
export const createOrder = (body: ReturnType<typeof toBody> & { metadata?: Record<string, unknown> | null }) => api<{ order: PurchaseOrder }>("/admin/purchase-orders", { method: "POST", body })
export const updateOrder = (id: string, body: Partial<ReturnType<typeof toBody>>) => api<{ order: PurchaseOrder }>(`/admin/purchase-orders/${id}`, { method: "POST", body })
export const deleteOrder = (id: string) => api<{ id: string }>(`/admin/purchase-orders/${id}`, { method: "DELETE" })
export const setOrderStatus = (id: string, status: "draft" | "sent" | "confirmed" | "cancelled", note?: string) => api<{ order: PurchaseOrder }>(`/admin/purchase-orders/${id}/status`, { method: "POST", body: { status, note: note || null } })
export const sendOrder = (id: string, body: { to: string[]; cc?: string[]; subject: string; message: string }) => api<{ order: PurchaseOrder; pdf_url: string | null }>(`/admin/purchase-orders/${id}/send`, { method: "POST", body })
export const duplicateOrder = (id: string) => api<{ order: PurchaseOrder }>(`/admin/purchase-orders/${id}/duplicate`, { method: "POST" })
export const addReceipt = (id: string, body: { received_at?: string; reference?: string | null; note?: string | null; lines: { line_id: string; quantity: number }[] }) => api<{ order: PurchaseOrder; receipt: Receipt }>(`/admin/purchase-orders/${id}/receipts`, { method: "POST", body })
export const addPayment = (id: string, body: { paid_at?: string; amount: number; method?: string | null; reference?: string | null; note?: string | null }) => api<{ order: PurchaseOrder; payment: Payment }>(`/admin/purchase-orders/${id}/payments`, { method: "POST", body })
export const removePayment = (id: string, paymentId: string) => api<{ order: PurchaseOrder }>(`/admin/purchase-orders/${id}/payments`, { method: "DELETE", query: { payment_id: paymentId } })
export const orderPdfUrl = (id: string, download = false) => `/admin/purchase-orders/${id}/pdf${download ? "?download=1" : ""}`

export const listSuppliers = (q?: string, activeOnly = false) => api<{ suppliers: Supplier[]; count: number }>("/admin/suppliers", { query: { q, active: activeOnly ? 1 : undefined, limit: 200 } })
export const createSupplier = (body: SupplierInput) => api<{ supplier: Supplier }>("/admin/suppliers", { method: "POST", body: clean(body) })
export const updateSupplier = (id: string, body: Partial<SupplierInput> & { active?: boolean }) => api<{ supplier: Supplier }>(`/admin/suppliers/${id}`, { method: "POST", body: clean(body) })
export const deleteSupplier = (id: string) => api<{ id: string }>(`/admin/suppliers/${id}`, { method: "DELETE" })

export const listItems = (q?: string, activeOnly = false) => api<{ items: PurchaseItem[]; count: number }>("/admin/purchase-items", { query: { q, active: activeOnly ? 1 : undefined, limit: 300 } })
export const createItem = (body: ItemInput) => api<{ item: PurchaseItem }>("/admin/purchase-items", { method: "POST", body: itemBody(body) })
export const updateItem = (id: string, body: Partial<ItemInput> & { active?: boolean }) => api<{ item: PurchaseItem }>(`/admin/purchase-items/${id}`, { method: "POST", body: itemBody(body) })
export const deleteItem = (id: string) => api<{ id: string }>(`/admin/purchase-items/${id}`, { method: "DELETE" })

export const listPurchaseProfiles = () => api<{ profiles: PurchaseProfile[] }>("/admin/purchase-profiles")
export const updatePurchaseProfile = (company: CompanyCode, body: Partial<PurchaseProfile>) => api<{ profile: PurchaseProfile }>(`/admin/purchase-profiles/${company}`, { method: "POST", body })

const clean = (b: object) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]))
const itemBody = (b: Partial<ItemInput> & { active?: boolean }) => { const o: Record<string, unknown> = clean(b); if ("last_price" in b) o.last_price = b.last_price === "" || b.last_price == null ? null : Number(b.last_price); if ("unit" in b) o.unit = b.unit || "Unidades"; if ("min_stock" in b) o.min_stock = b.min_stock === "" || b.min_stock == null ? null : Number(b.min_stock); return o }

export const errorMessage = (e: unknown, fallback: string) => (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string" ? (e as { message: string }).message : fallback)

/* ─── Stock of materials ─── */

export type StockReason = "receipt" | "consumption" | "return" | "adjustment"
export interface StockMovement { id: string; item_id: string; quantity: number; balance: number; reason: StockReason; ref_type: string | null; ref_id: string | null; ref_label: string | null; note: string | null; actor_email: string | null; created_at: string }
export const STOCK_REASON: Record<StockReason, string> = { receipt: "Recepción", consumption: "Consumo", return: "Devolución", adjustment: "Ajuste" }
export const getStock = (id: string) => api<{ stock: number; min_stock: number | null; unit: string; movements: StockMovement[] }>(`/admin/purchase-items/${id}/stock`)
export const adjustStock = (id: string, body: { count?: number; delta?: number; note?: string | null }) => api<{ stock: number; movement: StockMovement }>(`/admin/purchase-items/${id}/stock`, { method: "POST", body })
export const fmtQty = (n: number | string | null | undefined) => { const v = Math.round((Number(n) || 0) * 1000) / 1000; return v.toLocaleString("es-PA", { maximumFractionDigits: 3 }) }
