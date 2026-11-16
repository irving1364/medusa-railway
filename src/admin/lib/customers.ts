import type { HttpTypes } from "@medusajs/framework/types"
import { sdk } from "./sdk"

export type CustomerType = "person" | "company"

/** Form model. Native Medusa fields + metadata (type, sector, province, fiscal data). */
export interface CustomerInput {
  type: CustomerType
  name: string
  contact: string
  phone: string
  email: string
  sector: string
  province: string
  ruc: string
  dv: string
  fiscal_address: string
  district: string
  notes: string
}

export const SECTORS = ["Veterinario", "Médico", "Odontológico", "Laboratorio", "Industrial / técnico", "Hostelería / alimentos", "Gobierno / institución", "Otro"]
export const PROVINCES = ["Panamá", "Panamá Oeste", "Colón", "Coclé", "Chiriquí", "Veraguas", "Herrera", "Los Santos", "Bocas del Toro", "Darién", "Guna Yala", "Emberá-Wounaan", "Ngäbe-Buglé"]

export const emptyCustomer = (): CustomerInput => ({ type: "person", name: "", contact: "", phone: "", email: "", sector: "", province: "", ruc: "", dv: "", fiscal_address: "", district: "", notes: "" })

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))

/** Display name as it goes on documents: company name, or the person's full name. */
export const customerName = (c: HttpTypes.AdminCustomer) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "—"
export const customerType = (c: HttpTypes.AdminCustomer): CustomerType => ((c.metadata as Record<string, unknown> | null)?.type === "company" || (!!c.company_name && !c.first_name) ? "company" : "person")
export const fiscalId = (c: HttpTypes.AdminCustomer) => { const m = (c.metadata || {}) as Record<string, unknown>; const ruc = str(m.ruc); return ruc ? `${ruc}${str(m.dv) ? ` DV ${str(m.dv)}` : ""}` : "" }

export const toInput = (c: HttpTypes.AdminCustomer): CustomerInput => {
  const m = (c.metadata || {}) as Record<string, unknown>
  const type = customerType(c)
  return {
    type,
    name: type === "company" ? c.company_name || "" : [c.first_name, c.last_name].filter(Boolean).join(" "),
    contact: type === "company" ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "",
    phone: c.phone || "", email: c.email || "",
    sector: str(m.sector), province: str(m.province), ruc: str(m.ruc), dv: str(m.dv), fiscal_address: str(m.fiscal_address), district: str(m.district), notes: str(m.notes),
  }
}

/** Splits "Dra. María Pérez" into first/last for Medusa's native fields. */
const splitName = (full: string) => { const parts = full.trim().split(/\s+/); return parts.length > 1 ? { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] } : { first_name: full.trim(), last_name: "" } }

export const toPayload = (f: CustomerInput, existing?: HttpTypes.AdminCustomer | null) => {
  const person = f.type === "person" ? splitName(f.name) : f.contact.trim() ? splitName(f.contact) : { first_name: "", last_name: "" }
  const metadata = { ...((existing?.metadata as Record<string, unknown>) || {}), type: f.type, sector: f.sector || null, province: f.province || null, ruc: f.ruc.trim() || null, dv: f.dv.trim() || null, fiscal_address: f.fiscal_address.trim() || null, district: f.district.trim() || null, notes: f.notes.trim() || null }
  return {
    first_name: person.first_name || null,
    last_name: person.last_name || null,
    company_name: f.type === "company" ? f.name.trim() : null,
    email: f.email.trim() || null,
    phone: f.phone.trim() || null,
    metadata,
  }
}

export const validate = (f: CustomerInput): string | null => {
  if (!f.name.trim()) return f.type === "company" ? "Escriba el nombre de la empresa o institución" : "Escriba el nombre completo"
  if (!f.phone.trim() && !f.email.trim()) return "Indique al menos un teléfono o un correo"
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "El correo no parece válido"
  return null
}

export const listCustomers = (query: { q?: string; limit?: number; offset?: number }) => sdk.admin.customer.list({ ...query, order: "-created_at" } as HttpTypes.AdminCustomerFilters)
export const getCustomer = (id: string) => sdk.admin.customer.retrieve(id)
export const createCustomer = (body: ReturnType<typeof toPayload>) => sdk.admin.customer.create(body as HttpTypes.AdminCreateCustomer)
export const updateCustomer = (id: string, body: ReturnType<typeof toPayload>) => sdk.admin.customer.update(id, body as HttpTypes.AdminUpdateCustomer)
export const deleteCustomer = (id: string) => sdk.admin.customer.delete(id)

/** Fields a quote takes from a customer. */
export const quoteFieldsFrom = (c: HttpTypes.AdminCustomer) => {
  const m = (c.metadata || {}) as Record<string, unknown>
  const type = customerType(c)
  const contact = [c.first_name, c.last_name].filter(Boolean).join(" ")
  return {
    customer_id: c.id,
    customer_name: customerName(c),
    customer_company: "",
    contact_name: type === "company" ? contact : "",
    customer_email: c.email || "",
    customer_phone: c.phone || "",
    customer_ruc: str(m.ruc) ? `${str(m.ruc)}${str(m.dv) ? `-${str(m.dv)}` : ""}` : "",
    customer_address: [str(m.fiscal_address), str(m.district), str(m.province)].filter(Boolean).join(", ") || [c.addresses?.[0]?.address_1, c.addresses?.[0]?.city].filter(Boolean).join(", "),
  }
}

export const errorMessage = (e: unknown, fallback: string) => {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message
  return fallback
}
