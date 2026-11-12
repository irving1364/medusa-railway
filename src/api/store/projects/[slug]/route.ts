import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PROJECT_MODULE } from "../../../../modules/project"
import type ProjectModuleService from "../../../../modules/project/service"
import { PUBLIC_FIELDS } from "../route"

const PREVIEW_SECRET = process.env.PROJECT_PREVIEW_SECRET || ""

/**
 * GET /store/projects/:slug — one published project.
 * With ?preview=<PROJECT_PREVIEW_SECRET> any status is returned (admin "Vista previa").
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(PROJECT_MODULE) as ProjectModuleService
  const preview = !!PREVIEW_SECRET && String(req.query.preview || "") === PREVIEW_SECRET
  const filters: Record<string, unknown> = { slug: req.params.slug }
  if (!preview) filters.status = "published"
  const [project] = await service.listProjects(filters, { select: PUBLIC_FIELDS, take: 1 })
  if (!project) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Proyecto no encontrado")
  res.json({ project, preview })
}
