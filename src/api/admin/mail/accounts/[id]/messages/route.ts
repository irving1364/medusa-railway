import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listMessages } from "../../../../../../modules/mail/client"
import { accountSettings, folderParam, mailCall } from "../../../helpers"

/** GET /admin/mail/accounts/:id/messages?folder=INBOX&page=0&q= — newest first; `q` searches sender, recipients and subject. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const result = await mailCall(() => listMessages(settings, folderParam(req), { page: Number(req.query.page) || 0, size: Number(req.query.size) || 40, q: String(req.query.q || "") }))
  res.json(result)
}
