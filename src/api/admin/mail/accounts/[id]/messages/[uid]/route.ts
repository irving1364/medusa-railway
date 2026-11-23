import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMessage, removeMessage } from "../../../../../../../modules/mail/client"
import { accountSettings, folderParam, mailCall, uidParam } from "../../../../helpers"

/** GET /admin/mail/accounts/:id/messages/:uid?folder=&images=1 — full message (sanitised HTML); marks it as read. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  const message = await mailCall(() => getMessage(settings, folderParam(req), uidParam(req), { images: req.query.images === "1", markSeen: req.query.peek !== "1" }))
  res.json({ message })
}

/** DELETE /admin/mail/accounts/:id/messages/:uid?folder=&permanent=1 — to the trash, or for good from the trash. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { settings } = await accountSettings(req)
  res.json(await mailCall(() => removeMessage(settings, folderParam(req), uidParam(req), req.query.permanent === "1")))
}
