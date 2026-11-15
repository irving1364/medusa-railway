import { model } from "@medusajs/framework/utils"

/** Old product URL → current handle. Created when a published product's URL is changed from the admin. */
const ProductRedirect = model.define("product_redirect", {
  id: model.id({ prefix: "pred" }).primaryKey(),
  from_handle: model.text().unique(),
  to_handle: model.text(),
  product_id: model.text().nullable(),
})

export default ProductRedirect
