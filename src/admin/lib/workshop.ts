import { sdk } from "./sdk"
import type { CompanyCode } from "./companies"

export type WorkType = "fabrication" | "repair" | "maintenance"
export type WorkStage = "preparation" | "scheduled" | "in_progress" | "inspection" | "released" | "delivered" | "closed" | "cancelled"
export type Priority = "low" | "normal" | "high" | "urgent"
export type Materials = "pending" | "partial" | "complete"
export type ActivityStatus = "pending" | "in_progress" | "done"
export interface CheckItem { label: string; done: boolean }

export interface Resource { id: string; name: string; role: string | null; weekly_capacity: number; daily_capacity: number; active: boolean; sort_order: number; deleted_at?: string | null }
export interface Activity { id: string; order_id: string; name: string; date: string | null; resource_id: string | null; hours: number; actual_hours: number | null; status: ActivityStatus; sort_order: number; notes: string | null }
export interface Material { id: string; order_id: string; item_id: string | null; item_ref: string | null; name: string; unit: string; required: number; consumed: number; remaining: number; stock: number | null; min_stock: number | null; last_price: number | null; shortfall: number; note: string | null }
export interface LinkedPurchase { id: string; number: string; status: string; supplier_name: string; expected_date: string | null; total: number }
export interface WorkEvent { id: string; action: string; note: string | null; actor_email: string | null; created_at: string }
export interface WorkOrder {
  id: string
  number: string
  company: CompanyCode
  type: WorkType
  title: string
  description: string | null
  client_name: string | null
  customer_id: string | null
  quote_id: string | null
  quote_number: string | null
  quantity: number
  due_date: string | null
  finish_date: string | null
  priority: Priority
  stage: WorkStage
  materials: Materials
  materials_note: string | null
  owner_id: string | null
  blocked: boolean
  blocker: string | null
  blocked_since: string | null
  next_action: string | null
  notes: string | null
  checklist: CheckItem[]
  inspected_at: string | null
  inspected_by: string | null
  released_at: string | null
  delivered_at: string | null
  delivery_note: string | null
  closed_at: string | null
  created_at: string
  progress?: { total: number; done: number; activities: number; unscheduled: number }
  activities?: Activity[]
  material_lines?: Material[]
  purchase_orders?: LinkedPurchase[]
  events?: WorkEvent[]
  metadata?: Record<string, unknown> | null
}
export interface Schedule { from: string; to: string; resources: Resource[]; orders: WorkOrder[]; activities: Activity[]; unscheduled: Activity[] }
export interface Summary { open: number; blocked: number; due_this_week: number; overdue: number; inspection: number }

export interface OrderInput {
  company: CompanyCode
  type: WorkType
  title: string
  description: string
  client_name: string
  customer_id: string
  quote_id: string
  quote_number: string
  quantity: number
  due_date: string
  finish_date: string
  priority: Priority
  materials: Materials
  materials_note: string
  owner_id: string
  next_action: string
  notes: string
}
export interface ActivityInput { name: string; date: string | null; resource_id: string | null; hours: number; actual_hours?: number | null; status?: ActivityStatus; notes?: string | null }

/* ─── Labels ─── */

export const TYPE_LABEL: Record<WorkType, string> = { fabrication: "Fabricación", repair: "Reparación", maintenance: "Mantenimiento" }
export const STAGE_LABEL: Record<WorkStage, string> = {
  preparation: "Preparación", scheduled: "Programado", in_progress: "En proceso", inspection: "En inspección",
  released: "Liberado", delivered: "Entregado", closed: "Cerrado", cancelled: "Cancelado",
}
export const STAGES: WorkStage[] = ["preparation", "scheduled", "in_progress", "inspection", "released", "delivered", "closed"]
export const OPEN_STAGES: WorkStage[] = ["preparation", "scheduled", "in_progress", "inspection"]
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" }
export const MATERIALS_LABEL: Record<Materials, string> = { pending: "Pendientes", partial: "Parciales", complete: "Completos" }
export const ACTIVITY_LABEL: Record<ActivityStatus, string> = { pending: "Pendiente", in_progress: "En proceso", done: "Hecho" }

type Color = "grey" | "blue" | "green" | "orange" | "red" | "purple"
export const stageColor = (s: WorkStage): Color =>
  s === "in_progress" ? "blue" : s === "inspection" ? "orange" : s === "released" || s === "delivered" ? "green" : s === "scheduled" ? "purple" : s === "cancelled" ? "red" : "grey"
export const priorityColor = (p: Priority): Color => (p === "urgent" ? "red" : p === "high" ? "orange" : p === "low" ? "grey" : "blue")
export const materialsColor = (m: Materials): Color => (m === "complete" ? "green" : m === "partial" ? "orange" : "red")
export const activityColor = (s: ActivityStatus): Color => (s === "done" ? "green" : s === "in_progress" ? "blue" : "grey")

/** Typical operations offered when creating an order (the workshop picks and adjusts them). */
export const ACTIVITY_TEMPLATES: Record<WorkType, { name: string; hours: number }[]> = {
  fabrication: [
    { name: "Corte y preparación", hours: 4 }, { name: "Doblez", hours: 3 }, { name: "Soldadura TIG", hours: 6 },
    { name: "Armado", hours: 4 }, { name: "Pulido y acabado", hours: 4 }, { name: "Limpieza y empaque", hours: 1 },
  ],
  repair: [{ name: "Diagnóstico y fotos", hours: 2 }, { name: "Reparación y ajuste", hours: 4 }, { name: "Verificación funcional", hours: 1 }],
  maintenance: [{ name: "Inspección de componentes", hours: 2 }, { name: "Ajustes y registro", hours: 2 }],
}

/* ─── API ─── */

const api = <T,>(path: string, init: { method?: string; body?: unknown } = {}) => sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body })
const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}
const W = "/admin/workshop"

export const listOrders = (params: { company?: string; stage?: string; type?: string; blocked?: boolean; q?: string; quote_id?: string; customer_id?: string } = {}) =>
  api<{ orders: WorkOrder[]; count: number }>(`${W}/orders${qs({ ...params, blocked: params.blocked ? 1 : undefined })}`)
export const getOrder = (id: string) => api<{ order: WorkOrder }>(`${W}/orders/${id}`)
export const createOrder = (body: Partial<OrderInput> & { activities?: ActivityInput[]; metadata?: Record<string, unknown> | null }) => api<{ order: WorkOrder }>(`${W}/orders`, { method: "POST", body: nulls(body) })
export const updateOrder = (id: string, body: Partial<OrderInput> & { blocked?: boolean; blocker?: string | null; checklist?: CheckItem[]; delivery_note?: string | null }) =>
  api<{ order: WorkOrder }>(`${W}/orders/${id}`, { method: "POST", body: nulls(body) })
export const deleteOrder = (id: string) => api(`${W}/orders/${id}`, { method: "DELETE" })
export const setStage = (id: string, stage: WorkStage, note?: string) => api<{ order: WorkOrder }>(`${W}/orders/${id}/stage`, { method: "POST", body: { stage, note: note || null } })
export const addActivity = (orderId: string, body: ActivityInput) => api<{ order: WorkOrder }>(`${W}/orders/${orderId}/activities`, { method: "POST", body })
export const updateActivity = (id: string, body: Partial<ActivityInput> & { sort_order?: number }) => api<{ activity: Activity; warnings: string[] }>(`${W}/activities/${id}`, { method: "POST", body })
export const deleteActivity = (id: string) => api(`${W}/activities/${id}`, { method: "DELETE" })
export const addMaterial = (orderId: string, body: { item_id?: string | null; name?: string; unit?: string; required: number; note?: string | null }) => api<{ order: WorkOrder }>(`${W}/orders/${orderId}/materials`, { method: "POST", body })
export const updateMaterial = (id: string, body: { required?: number; note?: string | null; name?: string; unit?: string }) => api<{ order: WorkOrder }>(`${W}/materials/${id}`, { method: "POST", body })
export const deleteMaterial = (id: string) => api<{ order: WorkOrder }>(`${W}/materials/${id}`, { method: "DELETE" })
/** quantity > 0 consumes from stock, < 0 returns it. */
export const consumeMaterial = (id: string, quantity: number, note?: string) => api<{ order: WorkOrder; warnings: string[] }>(`${W}/materials/${id}/consume`, { method: "POST", body: { quantity, note: note || null } })
export const listResources = (active = false) => api<{ resources: Resource[] }>(`${W}/resources${qs({ active: active ? 1 : undefined })}`)
export const createResource = (body: Partial<Resource>) => api<{ resource: Resource }>(`${W}/resources`, { method: "POST", body })
export const updateResource = (id: string, body: Partial<Resource>) => api<{ resource: Resource }>(`${W}/resources/${id}`, { method: "POST", body })
export const deleteResource = (id: string) => api(`${W}/resources/${id}`, { method: "DELETE" })
export const getSchedule = (from: string, to: string, company?: string) => api<Schedule>(`${W}/schedule${qs({ from, to, company })}`)
/** Printable PDFs (same-origin, the admin session cookie authorises them). */
export const orderPdfUrl = (id: string, download = false) => `${W}/orders/${id}/pdf${download ? "?download=1" : ""}`
export const weekPdfUrl = (monday: string, company?: string) => `${W}/schedule/pdf${qs({ week: monday, company })}`
export const getSummary = (company?: string) => api<Summary>(`${W}/summary${qs({ company, today: today() })}`)

/** Empty strings of the forms travel as null (the API keeps optional fields nullable). */
function nulls<T extends Record<string, unknown>>(body: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) out[k] = v === "" ? null : v
  return out as T
}

export const errorMessage = (e: unknown, fallback: string) => (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string" ? (e as { message: string }).message : fallback)

/* ─── Dates: plain "YYYY-MM-DD" in local time ─── */

const pad = (n: number) => String(n).padStart(2, "0")
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => iso(new Date())
export const parseDay = (s: string) => new Date(`${s}T12:00:00`)
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d) }
/** Monday of the week of the given day. */
export const mondayOf = (s: string) => { const d = parseDay(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d) }
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export const dayName = (s: string) => DAYS[parseDay(s).getDay()]
export const dayShort = (s: string) => { const d = parseDay(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}` }
export const fmtDay = (s: string | null | undefined) => (s ? s.split("-").reverse().join("/") : "Sin fecha")
export const fmtDateTime = (s: string | null | undefined) => { if (!s) return ""; const d = new Date(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const weekLabel = (monday: string) => { const sat = addDays(monday, 5); const a = parseDay(monday), b = parseDay(sat); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}` : `${dayShort(monday)} – ${dayShort(sat)} ${b.getFullYear()}` }
/** Days until the date (negative = overdue). */
export const daysUntil = (s: string | null) => (s ? Math.round((parseDay(s).getTime() - parseDay(today()).getTime()) / 86400000) : null)
export const hours = (n: number) => `${Math.round(n * 100) / 100} h`

export const emptyOrder = (company: CompanyCode, type: WorkType = "fabrication"): OrderInput => ({
  company, type, title: "", description: "", client_name: "", customer_id: "", quote_id: "", quote_number: "", quantity: 1, due_date: "", finish_date: "",
  priority: "normal", materials: "pending", materials_note: "", owner_id: "", next_action: "", notes: "",
})
export const orderToInput = (o: WorkOrder): OrderInput => ({
  company: o.company, type: o.type, title: o.title, description: o.description || "", client_name: o.client_name || "", customer_id: o.customer_id || "", quote_id: o.quote_id || "", quote_number: o.quote_number || "",
  quantity: o.quantity, due_date: o.due_date || "", finish_date: o.finish_date || "", priority: o.priority, materials: o.materials,
  materials_note: o.materials_note || "", owner_id: o.owner_id || "", next_action: o.next_action || "", notes: o.notes || "",
})
