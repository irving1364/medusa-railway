import { z } from "zod"

const nullableText = (max = 20000) => z.string().trim().max(max).nullable().optional()

export const GalleryItemSchema = z.object({
  type: z.enum(["image", "video", "embed"]),
  url: z.string().trim().min(1).max(2000),
  alt: z.string().trim().max(300).nullable().optional(),
  poster: z.string().trim().max(2000).nullable().optional(),
})

export const ProjectBodySchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  slug: z.string().trim().max(120).nullable().optional(),
  line: z.enum(["medico", "veterinario", "tecnico"]),
  specialty: nullableText(200),
  work_type: nullableText(200),
  client_name: nullableText(200),
  location: nullableText(200),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  summary: nullableText(600),
  client_need: nullableText(),
  solution: nullableText(),
  fabrication: nullableText(),
  cover_url: nullableText(2000),
  cover_alt: nullableText(300),
  gallery: z.array(GalleryItemSchema).max(60).optional(),
  related_product_ids: z.array(z.string()).max(24).optional(),
  seo_title: nullableText(120),
  seo_description: nullableText(320),
  sort_order: z.number().int().min(-1000).max(100000).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
})

export const CreateProjectSchema = ProjectBodySchema
export const UpdateProjectSchema = ProjectBodySchema.partial()

export const ProjectStatusSchema = z.object({
  status: z.enum(["draft", "review", "approved", "published"]),
  note: z.string().trim().max(1000).nullable().optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>
export type ProjectStatusInput = z.infer<typeof ProjectStatusSchema>
