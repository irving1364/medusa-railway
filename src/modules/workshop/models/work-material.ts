import { model } from "@medusajs/framework/utils"

/**
 * Material needed by a work order. `item_id` points to the materials catalogue of Compras (purchase_item)
 * so consumption discounts its stock; free-text lines (no item) are only a checklist.
 */
const WorkMaterial = model.define("work_material", {
  id: model.id({ prefix: "wmat" }).primaryKey(),
  order_id: model.text().index(),
  item_id: model.text().nullable(),
  name: model.text(),
  unit: model.text().default("Unidades"),
  required: model.number().default(1),
  consumed: model.number().default(0),
  sort_order: model.number().default(0),
  note: model.text().nullable(),
})

export default WorkMaterial
