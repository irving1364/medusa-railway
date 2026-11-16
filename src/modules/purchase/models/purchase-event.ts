import { model } from "@medusajs/framework/utils"

/** History line of a purchase order: created, updated, sent, status changes, receipts, payments. */
const PurchaseEvent = model.define("purchase_event", {
  id: model.id({ prefix: "pevt" }).primaryKey(),
  order_id: model.text().index(),
  action: model.text(),
  note: model.text().nullable(),
  data: model.json().nullable(),
  actor_email: model.text().nullable(),
})

export default PurchaseEvent
