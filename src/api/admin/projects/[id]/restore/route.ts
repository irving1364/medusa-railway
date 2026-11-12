import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { actorOf, projectService, withUrls, type Loose } from "../../helpers"

/** POST /admin/projects/:id/restore — brings an archived project back as a draft. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = projectService(req)
  const [archived] = await service.listProjects({ id: req.params.id, deleted_at: { $ne: null } }, { withDeleted: true, take: 1 })
  if (!archived) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Proyecto archivado no encontrado")
  await service.restoreProjects([archived.id])
  const slug = await service.uniqueSlug(archived.slug, archived.id)
  const project = await service.updateProjects({ id: archived.id, status: "draft", slug })
  const actor = await actorOf(req)
  await service.createProjectRevisions({ project_id: project.id, action: "restored", from_status: archived.status as string, to_status: "draft", ...actor } as Loose)
  res.json({ project: withUrls(project) })
}
