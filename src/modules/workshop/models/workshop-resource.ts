import { model } from "@medusajs/framework/utils"

/** A person (or station) of the workshop with its capacity. Shared by both companies: FABMETAL builds for KARVEN. */
const WorkshopResource = model.define("workshop_resource", {
  id: model.id({ prefix: "wres" }).primaryKey(),
  name: model.text(),
  role: model.text().nullable(),
  weekly_capacity: model.number().default(40),
  daily_capacity: model.number().default(9),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default WorkshopResource
