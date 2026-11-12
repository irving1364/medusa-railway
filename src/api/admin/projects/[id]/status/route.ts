import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { STATUS_TRANSITIONS, type ProjectStatus } from "../../../../../modules/project/service"
import { actorOf, projectService, withUrls, type Loose } from "../../helpers"
import type { ProjectStatusInput } from "../../validators"

const LABEL: Record<ProjectStatus, string> = { draft: "Borrador", review: "Revisión", approved: "Aprobación", published: "Publicación" }

/** POST /admin/projects/:id/status { status, note } — moves the project along the editorial flow. */
export async function POST(req: AuthenticatedMedusaRequest<ProjectStatusInput>, res: MedusaResponse) {
  const service = projectService(req)
  const before = await service.retrieveProject(req.params.id)
  const from = before.status as ProjectStatus
  const to = req.validatedBody.status
  if (from === to) return res.json({ project: withUrls(before) })
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `No se puede pasar de ${LABEL[from]} a ${LABEL[to]}`)
  }
  if (to === "published" && !before.cover_url && !(Array.isArray(before.gallery) && before.gallery.length)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Agregue al menos una fotografía antes de publicar")
  }
  const project = await service.updateProjects({
    id: before.id,
    status: to,
    published_at: to === "published" ? new Date() : before.published_at,
  })
  const actor = await actorOf(req)
  await service.createProjectRevisions({ project_id: project.id, action: "status", from_status: from, to_status: to, note: req.validatedBody.note || null, ...actor } as Loose)
  res.json({ project: withUrls(project) })
}
