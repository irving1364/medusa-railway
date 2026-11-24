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

export const CreateMaterialLineSchema = z.object({
  item_id: z.string().max(100).nullable().optional(),
  name: z.string().trim().max(300).optional(),
  unit: z.string().trim().max(40).optional(),
  required: z.number().positive("Indique la cantidad").max(1000000),
  note: text(500),
}).refine((v) => !!v.item_id || !!v.name, { message: "Elija un material del catálogo o escriba su nombre" })
export const UpdateMaterialLineSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  unit: z.string().trim().max(40).optional(),
  required: z.number().positive().max(1000000).optional(),
  note: text(500),
})
/** quantity > 0 consumes (takes from stock), quantity < 0 returns to stock. */
export const ConsumeSchema = z.object({
  quantity: z.number().min(-1000000).max(1000000).refine((n) => n !== 0, "Indique una cantidad"),
  note: text(500),
})

const photoKind = z.enum(["progress", "inspection", "delivery", "issue"])
/** Photos already uploaded through /admin/web-uploads, attached to the order. */
export const AddPhotosSchema = z.object({
  photos: z.array(z.object({
    url: z.string().url().max(2000),
    file_id: z.string().max(200).nullable().optional(),
    kind: photoKind,
    caption: text(300),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
  })).min(1).max(20),
})
export const UpdatePhotoSchema = z.object({ kind: photoKind.optional(), caption: text(300) })
