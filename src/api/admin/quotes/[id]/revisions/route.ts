import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { quoteService } from "../../helpers"

/** GET /admin/quotes/:id/revisions — history, newest first (snapshots omitted from the list). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const revisions = await quoteService(req).listQuoteRevisions({ quote_id: req.params.id }, { order: { created_at: "DESC" }, take: 200 })
  res.json({ revisions: revisions.map(({ snapshot: _s, ...r }) => ({ ...r, total: (_s as { total?: number } | null)?.total ?? null })) })
}
