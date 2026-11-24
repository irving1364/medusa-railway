import { model } from "@medusajs/framework/utils"

export const WO_TYPES = ["fabrication", "repair", "maintenance"]
export const WO_STAGES = ["preparation", "scheduled", "in_progress", "inspection", "released", "delivered", "closed", "cancelled"]
export const WO_PRIORITIES = ["low", "normal", "high", "urgent"]
export const WO_MATERIALS = ["pending", "partial", "complete"]

/**
 * A workshop job (orden de trabajo): fabrication (OP-…), repair or maintenance (OT-…).
 * The stage and the blocker are independent: an order can be "in_progress" and blocked at the same time.
 * Dates are plain "YYYY-MM-DD" strings (the workshop plans by day, no time zones involved).
 */
const WorkOrder = model.define("work_order", {
  id: model.id({ prefix: "wo" }).primaryKey(),
  number: model.text().unique(),
  company: model.enum(["fabmetal", "karven"]).default("fabmetal"),
  type: model.enum(WO_TYPES).default("fabrication"),
  title: model.text().searchable(),
  description: model.text().nullable(),
  client_name: model.text().searchable().nullable(),
  customer_id: model.text().nullable(),
  quote_id: model.text().nullable(),
  quote_number: model.text().nullable(),
  quantity: model.number().default(1),
  due_date: model.text().nullable(),
  /** First committed delivery date: the reports measure on-time delivery against it even if due_date is moved later. */
  original_due_date: model.text().nullable(),
  finish_date: model.text().nullable(),
  priority: model.enum(WO_PRIORITIES).default("normal"),
  stage: model.enum(WO_STAGES).default("preparation"),
  materials: model.enum(WO_MATERIALS).default("pending"),
  materials_note: model.text().nullable(),
  owner_id: model.text().nullable(),
  blocked: model.boolean().default(false),
  blocker: model.text().nullable(),
  blocked_since: model.dateTime().nullable(),
  next_action: model.text().nullable(),
  notes: model.text().nullable(),
  /** [{ label, done }] copied from the template of the type on creation, editable per order */
  checklist: model.json().nullable(),
  inspected_at: model.dateTime().nullable(),
  inspected_by: model.text().nullable(),
  released_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  delivery_note: model.text().nullable(),
  closed_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

export default WorkOrder
