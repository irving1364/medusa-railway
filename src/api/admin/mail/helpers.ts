import { MedusaError } from "@medusajs/framework/utils"
import { MAIL_MODULE } from "../../../modules/mail"
import type MailModuleService from "../../../modules/mail/service"
import { MailError, settingsOf, type MailSettings } from "../../../modules/mail/client"

export type Loose = Record<string, any>

export const mailService = (req: { scope: any }) => req.scope.resolve(MAIL_MODULE) as MailModuleService

/** Connection settings of an active account (password decrypted in memory only). */
export async function accountSettings(req: { scope: any; params: Record<string, string> }): Promise<{ account: Loose; settings: MailSettings }> {
  const account = await mailService(req).retrieveMailAccount(req.params.id).catch(() => null)
  if (!account) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cuenta de correo no encontrada")
  if (!account.active) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La cuenta está desactivada")
  try {
    return { account, settings: settingsOf(account) }
  } catch (e) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, e instanceof Error ? e.message : String(e))
  }
}

/** Mail server problems reach the admin as readable 400s instead of 500s. */
export async function mailCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof MailError) throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
    throw e
  }
}

export const folderParam = (req: { query: Record<string, unknown> }, fallback = "INBOX") => {
  const f = String(req.query.folder || "").trim()
  return f || fallback
}

export const uidParam = (req: { params: Record<string, string> }) => {
  const uid = Number(req.params.uid)
  if (!Number.isInteger(uid) || uid < 1) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Mensaje no válido")
  return uid
}
