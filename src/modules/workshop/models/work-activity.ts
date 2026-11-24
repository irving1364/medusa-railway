import { model } from "@medusajs/framework/utils"

export const ACTIVITY_STATUSES = ["pending", "in_progress", "done"]

/** One operation of a work order (corte, soldadura, pulido…) planned on a day for one person. */
const WorkActivity = model.define("work_activity", {
  id: model.id({ prefix: "wact" }).primaryKey(),
  order_id: model.text().index(),
  name: model.text(),
  /** "YYYY-MM-DD"; null = por programar */
  date: model.text().nullable(),
  resource_id: model.text().nullable(),
  hours: model.number().default(1),
  actual_hours: model.number().nullable(),
  status: model.enum(ACTIVITY_STATUSES).default("pending"),
  sort_order: model.number().default(0),
  notes: model.text().nullable(),
})

export default WorkActivity
