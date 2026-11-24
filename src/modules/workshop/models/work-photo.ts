import { model } from "@medusajs/framework/utils"

export const PHOTO_KINDS = ["progress", "inspection", "delivery", "issue"]

/** Photo evidence of a work order: progress, quality inspection, delivery, or an issue found (incidencia). */
const WorkPhoto = model.define("work_photo", {
  id: model.id({ prefix: "wph" }).primaryKey(),
  order_id: model.text().index(),
  kind: model.enum(PHOTO_KINDS).default("progress"),
  url: model.text(),
  file_id: model.text().nullable(),
  caption: model.text().nullable(),
  width: model.number().nullable(),
  height: model.number().nullable(),
  actor_email: model.text().nullable(),
})

export default WorkPhoto
