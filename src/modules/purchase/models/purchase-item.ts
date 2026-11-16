import { model } from "@medusajs/framework/utils"

/** Materials and supplies bought from suppliers (láminas, tubos, consumibles). Separate from the web catalogue. */
const PurchaseItem = model.define("purchase_item", {
  id: model.id({ prefix: "pitem" }).primaryKey(),
  ref: model.text().nullable(),
  name: model.text().searchable(),
  description: model.text().nullable(),
  unit: model.text().default("Unidades"),
  category: model.text().nullable(),
  last_price: model.number().nullable(),
  last_supplier_id: model.text().nullable(),
  last_supplier_name: model.text().nullable(),
  last_bought_at: model.dateTime().nullable(),
  active: model.boolean().default(true),
})

export default PurchaseItem
