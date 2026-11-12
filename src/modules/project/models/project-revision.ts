import { model } from "@medusajs/framework/utils"

/** One line of a project's history: who did what, when, and which fields changed. */
const ProjectRevision = model.define("project_revision", {
  id: model.id({ prefix: "prev" }).primaryKey(),
  project_id: model.text().index(),
  /** created | updated | status | archived | restored */
  action: model.text(),
  from_status: model.text().nullable(),
  to_status: model.text().nullable(),
  /** { field: { from, to } } */
  changes: model.json().nullable(),
  note: model.text().nullable(),
  actor_id: model.text().nullable(),
  actor_email: model.text().nullable(),
})

export default ProjectRevision
