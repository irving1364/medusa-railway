import { z } from "zod"

export const CreateMaterialSchema = z.object({
  name: z.string().trim().min(1).max(80),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const UpdateMaterialSchema = CreateMaterialSchema.partial()

export const CreateRedirectSchema = z.object({
  from_handle: z.string().trim().min(1).max(160),
  to_handle: z.string().trim().min(1).max(160),
  product_id: z.string().trim().max(60).nullable().optional(),
})
