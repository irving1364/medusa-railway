import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROJECT_MODULE } from "../../../modules/project"
import type ProjectModuleService from "../../../modules/project/service"

export const PUBLIC_FIELDS = [
  "id", "title", "slug", "line", "specialty", "work_type", "client_name", "location", "year", "summary",
  "client_need", "solution", "fabrication", "cover_url", "cover_alt", "gallery", "related_product_ids",
  "seo_title", "seo_description", "status", "published_at", "sort_order", "updated_at",
]

/** GET /store/projects?line=&limit= — published projects for the portfolio page. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(PROJECT_MODULE) as ProjectModuleService
  const line = String(req.query.line || "").trim()
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200)
  const filters: Record<string, unknown> = { status: "published" }
  if (line) filters.line = line
  const [projects, count] = await service.listAndCountProjects(filters, {
    select: PUBLIC_FIELDS,
    take: limit,
    order: { sort_order: "ASC", published_at: "DESC" },
  })
  res.json({ projects, count })
}
