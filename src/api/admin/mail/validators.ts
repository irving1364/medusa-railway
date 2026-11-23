import { z } from "zod"

const host = z.string().trim().min(1).max(255).regex(/^[a-zA-Z0-9.-]+$/, "Servidor no válido")
const port = z.number().int().min(1).max(65535)
const emails = z.array(z.string().trim().email("Correo no válido").max(254)).max(100)

const AccountBase = z.object({
  company: z.enum(["fabmetal", "karven"]),
  label: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  display_name: z.string().trim().max(120).nullable().optional(),
  imap_host: host,
  imap_port: port,
  imap_secure: z.boolean(),
  smtp_host: host,
  smtp_port: port,
  smtp_secure: z.boolean(),
  username: z.string().trim().max(254).nullable().optional(),
  password: z.string().max(500).optional(),
  signature: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export const CreateMailAccountSchema = AccountBase.extend({ password: z.string().min(1, "Escriba la contraseña").max(500) })
export const UpdateMailAccountSchema = AccountBase.partial()
export const TestMailAccountSchema = AccountBase.extend({ account_id: z.string().max(60).nullable().optional() })

export const OutgoingSchema = z.object({
  to: emails.default([]),
  cc: emails.optional(),
  bcc: emails.optional(),
  subject: z.string().max(998).default(""),
  body: z.string().max(500000).default(""),
  in_reply_to: z.string().max(998).nullable().optional(),
  references: z.array(z.string().max(998)).max(200).nullable().optional(),
  attachments: z.array(z.object({ filename: z.string().min(1).max(255), content_type: z.string().max(255).nullable().optional(), content_base64: z.string() })).max(20).optional(),
  include_attachments_from: z.object({ folder: z.string().min(1).max(500), uid: z.number().int().positive(), skip: z.array(z.number().int().min(0)).optional() }).nullable().optional(),
  draft_uid: z.number().int().positive().nullable().optional(),
  reply_to: z.object({ folder: z.string().min(1).max(500), uid: z.number().int().positive() }).nullable().optional(),
})

export const FlagsSchema = z.object({ folder: z.string().min(1).max(500), seen: z.boolean().optional(), flagged: z.boolean().optional() })
export const MoveSchema = z.object({ folder: z.string().min(1).max(500), destination: z.string().min(1).max(500) })
