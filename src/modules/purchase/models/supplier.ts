import { model } from "@medusajs/framework/utils"

/** A supplier (proveedor). Shared by both companies. */
const Supplier = model.define("supplier", {
  id: model.id({ prefix: "sup" }).primaryKey(),
  name: model.text().searchable(),
  ruc: model.text().nullable(),
  dv: model.text().nullable(),
  contact_name: model.text().nullable(),
  phone: model.text().nullable(),
  email: model.text().nullable(),
  address: model.text().nullable(),
  payment_terms: model.text().nullable(),
  notes: model.text().nullable(),
  active: model.boolean().default(true),
})

export default Supplier
