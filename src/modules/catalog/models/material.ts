import { model } from "@medusajs/framework/utils"

/** Materials offered in the product form ("Material principal"). Managed from the admin; inactive ones are hidden from new products. */
const Material = model.define("material", {
  id: model.id({ prefix: "mat" }).primaryKey(),
  name: model.text().searchable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default Material
