import { model } from "@medusajs/framework/utils"

/** History line of a work order: created, stage changes, blockers, inspection, delivery. */
const WorkEvent = model.define("work_event", {
  id: model.id({ prefix: "wevt" }).primaryKey(),
  order_id: model.text().index(),
  action: model.text(),
  note: model.text().nullable(),
  data: model.json().nullable(),
  actor_email: model.text().nullable(),
})

export default WorkEvent
