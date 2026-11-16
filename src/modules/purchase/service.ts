import { MedusaService } from "@medusajs/framework/utils"
import PurchaseEvent from "./models/purchase-event"
import PurchaseItem from "./models/purchase-item"
import PurchaseOrder from "./models/purchase-order"
import PurchasePayment from "./models/purchase-payment"
import PurchaseProfile from "./models/purchase-profile"
import PurchaseReceipt from "./models/purchase-receipt"
import Supplier from "./models/supplier"

export type PurchaseCompany = "fabmetal" | "karven"
export type PurchaseStatus = "draft" | "sent" | "confirmed" | "partial" | "received" | "cancelled"

export interface PurchaseLine {
  id: string
  item_id: string | null
  ref: string | null
  title: string
  description: string | null
  quantity: number
  unit: string
  unit_price: number
  discount_pct: number
  tax_rate: number
  received_qty: number
}

type Loose = Record<string, any>
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const lineAmount = (l: PurchaseLine) => round((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (1 - (Number(l.discount_pct) || 0) / 100))

export const computeTotals = (lines: PurchaseLine[]) => {
  let gross = 0, subtotal = 0, tax = 0
  for (const l of lines) {
    const base = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0)
    const net = base * (1 - (Number(l.discount_pct) || 0) / 100)
    gross += base; subtotal += net; tax += net * ((Number(l.tax_rate) || 0) / 100)
  }
  return { subtotal: round(subtotal), discount_total: round(gross - subtotal), tax_total: round(tax), total: round(subtotal + tax) }
}

export const DEFAULT_PROFILES: Record<PurchaseCompany, Loose> = {
  fabmetal: { company: "fabmetal", number_prefix: "P", next_number: 17, ship_to_name: "FABMETAL", ship_to_address: "Alcalde Díaz, Panamá Norte, Panamá", ship_to_phone: "6726-8167", payment_terms: "", tax_rate: 7 },
  karven: { company: "karven", number_prefix: "PK", next_number: 1, ship_to_name: "KARVEN Medical", ship_to_address: "Calle Hato Azul casa N.º 43, La Cabima, Alcalde Díaz, Panamá", ship_to_phone: "6662-2199", payment_terms: "", tax_rate: 7 },
}

class PurchaseModuleService extends MedusaService({ Supplier, PurchaseItem, PurchaseOrder, PurchaseReceipt, PurchasePayment, PurchaseEvent, PurchaseProfile }) {
  async profileFor(company: PurchaseCompany): Promise<Loose> {
    const [existing] = await this.listPurchaseProfiles({ company }, { take: 1 })
    if (existing) return existing
    return this.createPurchaseProfiles(DEFAULT_PROFILES[company] as Loose)
  }

  /** Reserves the next number ("P00017") and advances the counter. */
  async nextNumber(company: PurchaseCompany): Promise<string> {
    const profile = await this.profileFor(company)
    let seq = Number(profile.next_number) || 1
    const existing = await this.listPurchaseOrders({ company }, { select: ["number"] })
    const taken = new Set(existing.map((o) => o.number))
    let number = `${profile.number_prefix || ""}${String(seq).padStart(5, "0")}`
    while (taken.has(number)) { seq += 1; number = `${profile.number_prefix || ""}${String(seq).padStart(5, "0")}` }
    await this.updatePurchaseProfiles({ id: profile.id, next_number: seq + 1 } as Loose)
    return number
  }

  /** Status derived from received quantities: received / partial / unchanged. */
  receptionStatus(lines: PurchaseLine[], current: PurchaseStatus): PurchaseStatus {
    const ordered = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
    const received = lines.reduce((s, l) => s + Math.min(Number(l.received_qty) || 0, Number(l.quantity) || 0), 0)
    if (ordered > 0 && received >= ordered) return "received"
    if (received > 0) return "partial"
    return current
  }

  /** Remembers the last price paid per item (used to prefill the next order). */
  async rememberPrices(lines: PurchaseLine[], supplierId: string | null, supplierName: string | null): Promise<void> {
    const updates = lines.filter((l) => l.item_id).map((l) => ({ id: l.item_id as string, last_price: Number(l.unit_price) || 0, last_supplier_id: supplierId, last_supplier_name: supplierName, last_bought_at: new Date() }))
    if (updates.length) await this.updatePurchaseItems(updates as Loose[])
  }
}

export default PurchaseModuleService
