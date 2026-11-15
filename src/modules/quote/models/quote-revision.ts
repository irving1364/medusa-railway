import { model } from "@medusajs/framework/utils"

/** Snapshot of a quote each time it is sent (or explicitly versioned), with the PDF that went out. */
const QuoteRevision = model.define("quote_revision", {
  id: model.id({ prefix: "qrev" }).primaryKey(),
  quote_id: model.text().index(),
  version: model.number(),
  action: model.text(),
  snapshot: model.json(),
  pdf_url: model.text().nullable(),
  sent_to: model.text().nullable(),
  note: model.text().nullable(),
  actor_email: model.text().nullable(),
})

export default QuoteRevision
