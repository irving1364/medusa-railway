import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setFlags } from "../../../../../../../../modules/mail/client"
import { accountSettings, mailCall, uidParam, type Loose } from "../../../../../helpers"

/** POST /admin/mail/accounts/:id/messages/:uid/flags { folder, seen?, flagged? } */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const { folder, seen, flagged } = req.validatedBody
  res.json(await mailCall(() => setFlags(settings, folder, uidParam(req), { seen, flagged })))
}
