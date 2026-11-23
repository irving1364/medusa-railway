import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { forget } from "../../../../../modules/mail/client"
import { encryptSecret, publicAccount } from "../../../../../modules/mail/service"
import { mailService, type Loose } from "../../helpers"

/** GET /admin/mail/accounts/:id */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ account: publicAccount(await mailService(req).retrieveMailAccount(req.params.id)) })
}

/** POST /admin/mail/accounts/:id — an empty password keeps the stored one. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const { password, ...body } = req.validatedBody
  const patch: Loose = { id: req.params.id, ...body }
  if (body.username === "" || body.username === null) delete patch.username
  if (password) patch.password_enc = encryptSecret(password)
  const account = await mailService(req).updateMailAccounts(patch)
  forget(req.params.id)
  res.json({ account: publicAccount(account) })
}

/** DELETE /admin/mail/accounts/:id — only removes the connection; the mailbox on the server is untouched. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await mailService(req).softDeleteMailAccounts([req.params.id])
  forget(req.params.id)
  res.json({ id: req.params.id, object: "mail_account", deleted: true })
}
