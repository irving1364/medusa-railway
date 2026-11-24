import { model } from "@medusajs/framework/utils"

/**
 * One change of the stock of a material: receipt of a purchase order (+), consumption by a work order (-),
 * return to stock (+) or physical count adjustment (±). `balance` is the stock right after the movement.
 */
const StockMovement = model.define("stock_movement", {
  id: model.id({ prefix: "smov" }).primaryKey(),
  item_id: model.text().index(),
  quantity: model.number(),
  balance: model.number(),
  reason: model.enum(["receipt", "consumption", "return", "adjustment"]),
  ref_type: model.text().nullable(),
  ref_id: model.text().nullable(),
  ref_label: model.text().nullable(),
  note: model.text().nullable(),
  actor_email: model.text().nullable(),
})

export default StockMovement
