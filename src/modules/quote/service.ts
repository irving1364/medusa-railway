import { MedusaService } from "@medusajs/framework/utils"
import Quote from "./models/quote"
import QuoteProfile from "./models/quote-profile"
import QuoteRevision from "./models/quote-revision"

export type QuoteStore = "fabmetal" | "karven"
export type QuoteStatus = "draft" | "sent" | "approved" | "rejected"

/** One row of a quote. Prices are in the quote currency (PAB); percentages 0–100. */
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

export interface QuoteTotals { subtotal: number; discount_total: number; tax_total: number; total: number }

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Subtotal is after line discounts (what the customer sees as "Subtotal"); taxes apply on the discounted amount. */
export const computeTotals = (lines: QuoteLine[]): QuoteTotals => {
  let gross = 0, subtotal = 0, tax = 0
  for (const l of lines) {
    const base = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0)
    const net = base * (1 - (Number(l.discount_pct) || 0) / 100)
    gross += base
    subtotal += net
    tax += net * ((Number(l.tax_rate) || 0) / 100)
  }
  return { subtotal: round(subtotal), discount_total: round(gross - subtotal), tax_total: round(tax), total: round(subtotal + tax) }
}

export const lineAmount = (l: QuoteLine) => round((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_pct) || 0) / 100))

/** Seeded per-store defaults; the admin edits them afterwards. */
export const DEFAULT_PROFILES: Record<QuoteStore, Record<string, unknown>> = {
  fabmetal: {
    store: "fabmetal",
    brand_line: "FABMETAL | KARVEN Medical",
    company_name: "MULTISERVICIOS CHIMAR, S.A.",
    tagline: "Fabricación técnica a medida. Precisión, durabilidad y control en cada proyecto.",
    ruc: "1042515-1-545471 D.V.09",
    address: "Alcalde Díaz, Panamá Norte, Panamá",
    website: "http://www.fabmetal.com.pa",
    email: "contact@fabmetal.com.pa",
    whatsapp: "6662-2199 / 6344-8362",
    bank_name: "Banco General",
    bank_holder: "MULTISERVICIOS CHIMAR, S.A.",
    bank_account_type: "Ahorro",
    bank_account_number: "04-51-00-001169-3",
    warranty_text: "El trabajo cuenta con 1 año de garantía por defectos de fabricación.",
    payment_terms: "60% de abono inicial para inicio de producción, compra de materiales y reserva de espacio en taller.\n30% contra avance verificable en taller, previo a despacho, entrega, instalación o etapa final del proyecto.\n10% contra entrega final del trabajo terminado.",
    general_terms: "El avance podrá ser validado mediante fotos, videos o visita al taller.\nLa entrega, despacho o instalación será programada una vez cancelado el 90% del valor total del proyecto.\nEl saldo final correspondiente al 10% será cancelado contra entrega del trabajo terminado.\nTodo cambio, adicional o modificación fuera del alcance cotizado deberá ser evaluado y cotizado por separado.",
    number_prefix: "S",
    number_digits: 5,
    next_number: 249,
    validity_days: 30,
    tax_rate: 7,
  },
  karven: {
    store: "karven",
    brand_line: "KARVEN Medical | FABMETAL",
    company_name: "MULTISERVICIOS CHIMAR, S.A.",
    tagline: "Mobiliario médico, veterinario y técnico fabricado en Panamá.",
    ruc: "1042515-1-545471 D.V.09",
    address: "Calle Hato Azul casa N.º 43, La Cabima, Alcalde Díaz, Panamá",
    website: "https://karvenmedical.com",
    email: "contact@karvenmedical.com",
    whatsapp: "6662-2199",
    bank_name: "Banco General",
    bank_holder: "MULTISERVICIOS CHIMAR, S.A.",
    bank_account_type: "Ahorro",
    bank_account_number: "04-51-00-001169-3",
    warranty_text: "El mobiliario cuenta con 1 año de garantía por defectos de fabricación.",
    payment_terms: "60% de abono inicial para inicio de producción, compra de materiales y reserva de espacio en taller.\n30% contra avance verificable en taller, previo a despacho, entrega, instalación o etapa final del proyecto.\n10% contra entrega final del trabajo terminado.",
    general_terms: "El avance podrá ser validado mediante fotos, videos o visita al taller.\nLa entrega, despacho o instalación será programada una vez cancelado el 90% del valor total del proyecto.\nEl saldo final correspondiente al 10% será cancelado contra entrega del trabajo terminado.\nTodo cambio, adicional o modificación fuera del alcance cotizado deberá ser evaluado y cotizado por separado.",
    number_prefix: "KM-",
    number_digits: 4,
    next_number: 1,
    validity_days: 30,
    tax_rate: 7,
  },
}

type Loose = Record<string, any>

class QuoteModuleService extends MedusaService({ Quote, QuoteRevision, QuoteProfile }) {
  /** Profile for a store, created from the defaults the first time it is needed. */
  async profileFor(store: QuoteStore): Promise<Loose> {
    const [existing] = await this.listQuoteProfiles({ store }, { take: 1 })
    if (existing) return existing
    return this.createQuoteProfiles(DEFAULT_PROFILES[store] as Loose)
  }

  /** Reserves the next number for a store ("S00249") and advances the counter. */
  async nextNumber(store: QuoteStore): Promise<string> {
    const profile = await this.profileFor(store)
    let seq = Number(profile.next_number) || 1
    const existing = await this.listQuotes({ store }, { select: ["number"] })
    const taken = new Set(existing.map((q) => q.number))
    const digits = Math.min(Math.max(Number(profile.number_digits) || 4, 3), 8)
    let number = `${profile.number_prefix || ""}${String(seq).padStart(digits, "0")}`
    while (taken.has(number)) { seq += 1; number = `${profile.number_prefix || ""}${String(seq).padStart(digits, "0")}` }
    await this.updateQuoteProfiles({ id: profile.id, next_number: seq + 1 } as Loose)
    return number
  }
}

export default QuoteModuleService
