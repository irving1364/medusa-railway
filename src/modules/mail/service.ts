import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { MedusaService } from "@medusajs/framework/utils"
import MailAccount from "./models/mail-account"

type Loose = Record<string, any>

/** Key for the stored mailbox passwords. Set MAIL_SECRET in Railway; COOKIE_SECRET is only a fallback for local runs. */
const key = () => {
  const secret = process.env.MAIL_SECRET || process.env.COOKIE_SECRET
  if (!secret) throw new Error("MAIL_SECRET no está configurado")
  return createHash("sha256").update(`karven-mail:${secret}`).digest()
}

export const encryptSecret = (plain: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":")
}

export const decryptSecret = (stored: string) => {
  const [v, iv, tag, data] = String(stored || "").split(":")
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Contraseña guardada ilegible; vuelva a escribirla en la cuenta")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
}

/** What the admin sees: everything except the password. */
export const publicAccount = (a: Loose) => {
  const { password_enc, ...rest } = a
  return { ...rest, has_password: !!password_enc }
}

class MailModuleService extends MedusaService({ MailAccount }) {}

export default MailModuleService
