import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { actorOf, diffProject, projectService, withUrls, type Loose } from "../helpers"
import type { UpdateProjectInput } from "../validators"

/** GET /admin/projects/:id (also returns archived projects). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = projectService(req)
  const [project] = await service.listProjects({ id: req.params.id }, { withDeleted: true, take: 1 })
  if (!project) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Proyecto no encontrado")
  res.json({ project: withUrls(project) })
}

/** POST /admin/projects/:id — edits content; the status moves only through /status. */
export async function POST(req: AuthenticatedMedusaRequest<UpdateProjectInput>, res: MedusaResponse) {
  const service = projectService(req)
  const before = await service.retrieveProject(req.params.id)
  const body = { ...req.validatedBody }
  if (typeof body.slug === "string" || body.slug === null) {
    body.slug = await service.uniqueSlug(body.slug || before.title, before.id)
  }
  const project = await service.updateProjects({ id: before.id, ...body } as Loose)
  const changes = diffProject(before as unknown as Record<string, unknown>, project as unknown as Record<string, unknown>)
  if (Object.keys(changes).length) {
    const actor = await actorOf(req)
    await service.createProjectRevisions({ project_id: project.id, action: "updated", changes, ...actor } as Loose)
  }
  res.json({ project: withUrls(project) })
}

/** DELETE /admin/projects/:id — archives (soft delete); restorable from the "Archivados" tab. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = projectService(req)
  const before = await service.retrieveProject(req.params.id)
  await service.softDeleteProjects([before.id])
  const actor = await actorOf(req)
  await service.createProjectRevisions({ project_id: before.id, action: "archived", from_status: before.status as string, ...actor } as Loose)
  res.json({ id: before.id, object: "project", deleted: true })
}
