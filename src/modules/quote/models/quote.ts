import { model } from "@medusajs/framework/utils"

export const QUOTE_STORES = ["fabmetal", "karven"]
export const QUOTE_STATUSES = ["draft", "sent", "approved", "rejected"]

/** A sales quotation (cotización) with its lines stored as JSON; totals are computed on save. */
const Quote = model.define("quote", {
  id: model.id({ prefix: "quo" }).primaryKey(),
  number: model.text().unique(),
  store: model.enum(QUOTE_STORES),
  status: model.enum(QUOTE_STATUSES).default("draft"),
  version: model.number().default(1),
  customer_id: model.text().nullable(),
  customer_name: model.text().searchable(),
  customer_company: model.text().nullable(),
  customer_ruc: model.text().nullable(),
  customer_email: model.text().nullable(),
  customer_phone: model.text().nullable(),
  customer_address: model.text().nullable(),
  contact_name: model.text().nullable(),
  issue_date: model.dateTime(),
  valid_until: model.dateTime().nullable(),
  salesperson: model.text().nullable(),
  currency: model.text().default("pab"),
  lines: model.json(),
  subtotal: model.number().default(0),
  discount_total: model.number().default(0),
  tax_total: model.number().default(0),
  total: model.number().default(0),
  intro_text: model.text().nullable(),
  warranty_text: model.text().nullable(),
  payment_terms: model.text().nullable(),
  general_terms: model.text().nullable(),
  notes_internal: model.text().nullable(),
  order_id: model.text().nullable(),
  sent_at: model.dateTime().nullable(),
  approved_at: model.dateTime().nullable(),
  rejected_at: model.dateTime().nullable(),
  last_pdf_url: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default Quote
