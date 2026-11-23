import { model } from "@medusajs/framework/utils"

/**
 * A mailbox on the company's own mail server (cPanel / Dovecot), read over IMAP and sent through SMTP.
 * Messages are never copied into the database: Medusa works on the live mailbox, so Outlook and phones stay in sync.
 */
const MailAccount = model.define("mail_account", {
  id: model.id({ prefix: "mbox" }).primaryKey(),
  company: model.enum(["fabmetal", "karven"]).default("karven"),
  label: model.text(),
  email: model.text(),
  display_name: model.text().nullable(),
  imap_host: model.text(),
  imap_port: model.number().default(993),
  imap_secure: model.boolean().default(true),
  smtp_host: model.text(),
  smtp_port: model.number().default(465),
  smtp_secure: model.boolean().default(true),
  username: model.text(),
  /** AES-256-GCM, key from MAIL_SECRET (never returned by the API) */
  password_enc: model.text(),
  signature: model.text().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
  last_check_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
})

export default MailAccount
