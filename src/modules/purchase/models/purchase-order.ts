import { model } from "@medusajs/framework/utils"

export const PO_COMPANIES = ["fabmetal", "karven"]
export const PO_STATUSES = ["draft", "sent", "confirmed", "partial", "received", "cancelled"]

/** A purchase order (orden de compra) of one company to one supplier. Lines as JSON; totals computed on save. */
const PurchaseOrder = model.define("purchase_order", {
  id: model.id({ prefix: "po" }).primaryKey(),
  number: model.text().unique(),
  company: model.enum(PO_COMPANIES),
  status: model.enum(PO_STATUSES).default("draft"),
  supplier_id: model.text().nullable(),
  supplier_name: model.text().searchable(),
  supplier_ruc: model.text().nullable(),
  supplier_contact: model.text().nullable(),
  supplier_phone: model.text().nullable(),
  supplier_email: model.text().nullable(),
  supplier_address: model.text().nullable(),
  ship_to_name: model.text().nullable(),
  ship_to_address: model.text().nullable(),
  ship_to_phone: model.text().nullable(),
  order_date: model.dateTime(),
  expected_date: model.dateTime().nullable(),
  payment_terms: model.text().nullable(),
  currency: model.text().default("pab"),
  lines: model.json(),
  subtotal: model.number().default(0),
  discount_total: model.number().default(0),
  tax_total: model.number().default(0),
  total: model.number().default(0),
  paid_total: model.number().default(0),
  notes_internal: model.text().nullable(),
  invoice_reference: model.text().nullable(),
  sent_at: model.dateTime().nullable(),
  confirmed_at: model.dateTime().nullable(),
  received_at: model.dateTime().nullable(),
  cancelled_at: model.dateTime().nullable(),
  last_pdf_url: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default PurchaseOrder
