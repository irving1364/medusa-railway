import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { projectService } from "../../helpers"

/** GET /admin/projects/:id/revisions — history, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = projectService(req)
  const revisions = await service.listProjectRevisions({ project_id: req.params.id }, { order: { created_at: "DESC" }, take: 200 })
  res.json({ revisions })
}
