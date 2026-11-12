import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorOf, projectService, withUrls, type Loose } from "./helpers"
import type { CreateProjectInput } from "./validators"

/** GET /admin/projects?q=&status=&line=&deleted=1&limit=&offset= */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = projectService(req)
  const q = String(req.query.q || "").trim()
  const status = String(req.query.status || "").trim()
  const line = String(req.query.line || "").trim()
  const deleted = req.query.deleted === "1" || req.query.deleted === "true"
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)

  const filters: Record<string, unknown> = {}
  if (q) filters.title = { $ilike: `%${q}%` }
  if (status) filters.status = status
  if (line) filters.line = line
  if (deleted) filters.deleted_at = { $ne: null }

  const [projects, count] = await service.listAndCountProjects(filters, {
    take: limit,
    skip: offset,
    order: { updated_at: "DESC" },
    withDeleted: deleted,
  })
  res.json({ projects: projects.map(withUrls), count, limit, offset })
}

/** POST /admin/projects — creates a draft. */
export async function POST(req: AuthenticatedMedusaRequest<CreateProjectInput>, res: MedusaResponse) {
  const service = projectService(req)
  const body = req.validatedBody
  const slug = await service.uniqueSlug(body.slug || body.title)
  const project = await service.createProjects({
    ...body,
    slug,
    gallery: body.gallery || [],
    related_product_ids: body.related_product_ids || [],
    status: "draft",
  } as Loose)
  const actor = await actorOf(req)
  await service.createProjectRevisions({ project_id: project.id, action: "created", to_status: "draft", ...actor } as Loose)
  res.status(201).json({ project: withUrls(project) })
}
