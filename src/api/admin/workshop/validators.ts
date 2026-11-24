import { z } from "zod"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").nullable().optional()
const text = (max: number) => z.string().max(max).nullable().optional()
const check = z.object({ label: z.string().trim().min(1).max(300), done: z.boolean() })

const OrderBase = z.object({
  company: z.enum(["fabmetal", "karven"]),
  type: z.enum(["fabrication", "repair", "maintenance"]),
  title: z.string().trim().min(1, "Escriba el nombre del trabajo").max(300),
  description: text(5000),
  client_name: text(300),
  customer_id: text(100),
  quote_id: text(100),
  quote_number: text(60),
  quantity: z.number().int().min(1).max(100000),
  due_date: day,
  finish_date: day,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  materials: z.enum(["pending", "partial", "complete"]),
  materials_note: text(2000),
  owner_id: text(100),
  next_action: text(2000),
  notes: text(10000),
  delivery_note: text(2000),
  blocked: z.boolean(),
  blocker: text(1000),
  checklist: z.array(check).max(40),
  metadata: z.record(z.unknown()).nullable().optional(),
})

const ActivityInput = z.object({
  name: z.string().trim().min(1, "Escriba la operación").max(200),
  date: day,
  resource_id: text(100),
  hours: z.number().min(0.25).max(200),
  actual_hours: z.number().min(0).max(1000).nullable().optional(),
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  sort_order: z.number().int().optional(),
  notes: text(2000),
})

export const CreateWorkOrderSchema = OrderBase.partial().extend({
  title: OrderBase.shape.title,
  type: OrderBase.shape.type,
  company: OrderBase.shape.company,
  activities: z.array(ActivityInput).max(60).optional(),
})
export const UpdateWorkOrderSchema = OrderBase.partial()
export const WorkStageSchema = z.object({
  stage: z.enum(["preparation", "scheduled", "in_progress", "inspection", "released", "delivered", "closed", "cancelled"]),
  note: text(2000),
})
export const CreateActivitySchema = ActivityInput
export const UpdateActivitySchema = ActivityInput.partial()

export const ResourceSchema = z.object({
  name: z.string().trim().min(1, "Escriba el nombre").max(120),
  role: text(120),
  weekly_capacity: z.number().min(0).max(168).optional(),
  daily_capacity: z.number().min(0).max(24).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})
export const UpdateResourceSchema = ResourceSchema.partial()
