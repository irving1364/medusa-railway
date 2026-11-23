import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { testSettings } from "../../../../modules/mail/client"
import { decryptSecret } from "../../../../modules/mail/service"
import { mailService, type Loose } from "../helpers"

/** POST /admin/mail/test — tries IMAP and SMTP with the form values (stored password when the field is empty). */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const b = req.validatedBody
  let password = b.password || ""
  if (!password && b.account_id) {
    const account = await mailService(req).retrieveMailAccount(b.account_id).catch(() => null)
    if (account?.password_enc) password = decryptSecret(account.password_enc)
  }
  if (!password) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Escriba la contraseña para probar")
  const result = await testSettings({
    email: b.email, display_name: b.display_name || null, username: b.username || b.email, password,
    imap_host: b.imap_host, imap_port: b.imap_port, imap_secure: b.imap_secure,
    smtp_host: b.smtp_host, smtp_port: b.smtp_port, smtp_secure: b.smtp_secure,
  })
  res.json({ ok: !result.imap && !result.smtp, ...result })
}
