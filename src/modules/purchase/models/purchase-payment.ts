import { model } from "@medusajs/framework/utils"

/** A payment (abono) made to the supplier against a purchase order. Register and history only, no accounting. */
const PurchasePayment = model.define("purchase_payment", {
  id: model.id({ prefix: "ppay" }).primaryKey(),
  order_id: model.text().index(),
  paid_at: model.dateTime(),
  amount: model.number(),
  method: model.text().nullable(),
  reference: model.text().nullable(),
  note: model.text().nullable(),
  actor_email: model.text().nullable(),
})

export default PurchasePayment
