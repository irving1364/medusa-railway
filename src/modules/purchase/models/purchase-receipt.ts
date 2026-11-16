import { model } from "@medusajs/framework/utils"

/** Goods received against a purchase order (partial receipts allowed). `lines` = [{ line_id, quantity }]. */
const PurchaseReceipt = model.define("purchase_receipt", {
  id: model.id({ prefix: "prcpt" }).primaryKey(),
  order_id: model.text().index(),
  received_at: model.dateTime(),
  reference: model.text().nullable(),
  lines: model.json(),
  note: model.text().nullable(),
  actor_email: model.text().nullable(),
})

export default PurchaseReceipt
