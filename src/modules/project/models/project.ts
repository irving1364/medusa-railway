import { model } from "@medusajs/framework/utils"

export const PROJECT_LINES = ["medico", "veterinario", "tecnico"]
export const PROJECT_STATUSES = ["draft", "review", "approved", "published"]

/**
 * A portfolio project ("Proyectos" on karvenmedical.com): a documented job with gallery,
 * narrative blocks, SEO fields and an editorial status (draft -> review -> approved -> published).
 */
const Project = model.define("project", {
  id: model.id({ prefix: "proj" }).primaryKey(),
  title: model.text().searchable(),
  /** URL segment: karvenmedical.com/proyectos/<slug> */
  slug: model.text().unique(),
  line: model.enum(PROJECT_LINES),
  specialty: model.text().nullable(),
  work_type: model.text().nullable(),
  client_name: model.text().nullable(),
  location: model.text().nullable(),
  year: model.number().nullable(),
  /** Short text for the card */
  summary: model.text().nullable(),
  client_need: model.text().nullable(),
  solution: model.text().nullable(),
  fabrication: model.text().nullable(),
  cover_url: model.text().nullable(),
  cover_alt: model.text().nullable(),
  /** Ordered media: { type: "image" | "video" | "embed", url, alt?, poster? } */
  gallery: model.json(),
  related_product_ids: model.json(),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
  status: model.enum(PROJECT_STATUSES).default("draft"),
  published_at: model.dateTime().nullable(),
  sort_order: model.number().default(0),
  metadata: model.json().nullable(),
})

export default Project
