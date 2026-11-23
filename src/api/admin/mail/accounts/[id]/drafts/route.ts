import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveDraft } from "../../../../../../modules/mail/client"
import { accountSettings, mailCall, type Loose } from "../../../helpers"

/** POST /admin/mail/accounts/:id/drafts — saves to Borradores (replacing `draft_uid` when editing one). */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const { draft_uid, reply_to, ...msg } = req.validatedBody
  res.json(await mailCall(() => saveDraft(settings, msg as Loose as Parameters<typeof saveDraft>[1], draft_uid)))
}
