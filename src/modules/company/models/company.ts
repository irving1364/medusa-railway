import { model } from "@medusajs/framework/utils"

/**
 * A company (empresa) sharing this backend: FABMETAL and KARVEN Medical. Holds the legal identity used on
 * documents and emails and the sales channel that scopes its products and orders.
 */
const Company = model.define("company", {
  id: model.id({ prefix: "comp" }).primaryKey(),
  code: model.text().unique(),
  name: model.text(),
  brand_line: model.text(),
  legal_name: model.text(),
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
  from_email: model.text().nullable(),
  cc_email: model.text().nullable(),
  sales_channel_id: model.text().nullable(),
  storefront_url: model.text().nullable(),
  color: model.text().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default Company
