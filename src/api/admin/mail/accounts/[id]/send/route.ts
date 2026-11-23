import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendMessage } from "../../../../../../modules/mail/client"
import { accountSettings, mailCall, type Loose } from "../../../helpers"

/** POST /admin/mail/accounts/:id/send — SMTP, then a copy in Enviados; removes the draft and marks the original as answered. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const { draft_uid, reply_to, ...msg } = req.validatedBody
  res.json(await mailCall(() => sendMessage(settings, msg as Loose as Parameters<typeof sendMessage>[1], { draft_uid, reply_to })))
}
