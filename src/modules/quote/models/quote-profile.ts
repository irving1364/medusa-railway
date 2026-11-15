import { model } from "@medusajs/framework/utils"

/** Per-store settings for quotes: legal identity, bank details, default texts, numbering and email. Edited in the admin. */
const QuoteProfile = model.define("quote_profile", {
  id: model.id({ prefix: "qprof" }).primaryKey(),
  store: model.text().unique(),
  brand_line: model.text(),
  company_name: model.text(),
  tagline: model.text().nullable(),
  ruc: model.text().nullable(),
  address: model.text().nullable(),
  website: model.text().nullable(),
  email: model.text().nullable(),
  whatsapp: model.text().nullable(),
  logo_url: model.text().nullable(),
  bank_name: model.text().nullable(),
  bank_holder: model.text().nullable(),
  bank_account_type: model.text().nullable(),
  bank_account_number: model.text().nullable(),
  warranty_text: model.text().nullable(),
  payment_terms: model.text().nullable(),
  general_terms: model.text().nullable(),
  number_prefix: model.text().default("S"),
  next_number: model.number().default(1),
  validity_days: model.number().default(30),
  tax_rate: model.number().default(7),
  from_email: model.text().nullable(),
  cc_email: model.text().nullable(),
  email_signature: model.text().nullable(),
})

export default QuoteProfile
