import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { moveMessage } from "../../../../../../../../modules/mail/client"
import { accountSettings, mailCall, uidParam, type Loose } from "../../../../../helpers"

/** POST /admin/mail/accounts/:id/messages/:uid/move { folder, destination } */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const { folder, destination } = req.validatedBody
  res.json(await mailCall(() => moveMessage(settings, folder, uidParam(req), destination)))
}
