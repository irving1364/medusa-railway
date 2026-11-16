import { model } from "@medusajs/framework/utils"

/** Per-company purchasing settings: numbering, default ship-to address, default payment terms, tax. */
const PurchaseProfile = model.define("purchase_profile", {
  id: model.id({ prefix: "pprof" }).primaryKey(),
  company: model.text().unique(),
  number_prefix: model.text().default("P"),
  next_number: model.number().default(1),
  ship_to_name: model.text().nullable(),
  ship_to_address: model.text().nullable(),
  ship_to_phone: model.text().nullable(),
  payment_terms: model.text().nullable(),
  tax_rate: model.number().default(7),
  email_signature: model.text().nullable(),
})

export default PurchaseProfile
