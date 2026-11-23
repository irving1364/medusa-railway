import { sdk } from "./sdk"
import type { CompanyCode } from "./companies"

export interface MailAccount {
  id: string
  company: CompanyCode
  label: string
  email: string
  display_name: string | null
  imap_host: string
  imap_port: number
  imap_secure: boolean
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  username: string
  signature: string | null
  active: boolean
  sort_order: number
  last_check_at: string | null
  last_error: string | null
  has_password: boolean
}

export interface MailAccountInput {
  company: CompanyCode
  label: string
  email: string
  display_name: string
  imap_host: string
  imap_port: number
  imap_secure: boolean
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  username: string
  password: string
  signature: string
  active: boolean
}

export type Special = "inbox" | "drafts" | "sent" | "junk" | "trash" | "archive"
export interface Folder { path: string; name: string; special: Special | null; messages: number; unseen: number }
export interface Address { name: string; address: string }
export interface MessageSummary { uid: number; subject: string; from: Address[]; to: Address[]; date: string | null; seen: boolean; flagged: boolean; answered: boolean; draft: boolean; has_attachments: boolean; size: number }
export interface MessageList { messages: MessageSummary[]; total: number; page: number; size: number }
export interface Attachment { index: number; filename: string; content_type: string; size: number }
export interface Message {
  uid: number
  folder: string
  subject: string
  from: Address[]
  to: Address[]
  cc: Address[]
  bcc: Address[]
  reply_to: Address[]
  date: string | null
  message_id: string | null
  in_reply_to: string | null
  references: string[]
  html: string
  text: string
  remote_images_blocked: number
  flagged: boolean
  answered: boolean
  draft: boolean
  attachments: Attachment[]
}

export interface Outgoing {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  in_reply_to?: string | null
  references?: string[] | null
  attachments?: { filename: string; content_type?: string | null; content_base64: string }[]
  include_attachments_from?: { folder: string; uid: number; skip?: number[] } | null
  draft_uid?: number | null
  reply_to?: { folder: string; uid: number } | null
}

const api = <T,>(path: string, init: { method?: string; body?: unknown } = {}) => sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body })
const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}
const A = (id: string) => `/admin/mail/accounts/${id}`

export const listAccounts = (company?: CompanyCode) => api<{ accounts: MailAccount[] }>(`/admin/mail/accounts${qs({ company })}`)
export const createAccount = (body: Partial<MailAccountInput>) => api<{ account: MailAccount }>("/admin/mail/accounts", { method: "POST", body })
export const updateAccount = (id: string, body: Partial<MailAccountInput>) => api<{ account: MailAccount }>(A(id), { method: "POST", body })
export const deleteAccount = (id: string) => api<{ deleted: boolean }>(A(id), { method: "DELETE" })
export const testAccount = (body: Partial<MailAccountInput> & { account_id?: string | null }) => api<{ ok: boolean; imap: string | null; smtp: string | null; folders: number }>("/admin/mail/test", { method: "POST", body })

export const listFolders = (id: string) => api<{ folders: Folder[] }>(`${A(id)}/folders`)
export const listMessages = (id: string, folder: string, page = 0, q = "") => api<MessageList>(`${A(id)}/messages${qs({ folder, page, q })}`)
export const getMessage = (id: string, folder: string, uid: number, images = false) => api<{ message: Message }>(`${A(id)}/messages/${uid}${qs({ folder, images: images ? 1 : undefined })}`)
export const setFlags = (id: string, folder: string, uid: number, flags: { seen?: boolean; flagged?: boolean }) => api(`${A(id)}/messages/${uid}/flags`, { method: "POST", body: { folder, ...flags } })
export const removeMessage = (id: string, folder: string, uid: number, permanent = false) => api<{ deleted: boolean; moved_to: string | null }>(`${A(id)}/messages/${uid}${qs({ folder, permanent: permanent ? 1 : undefined })}`, { method: "DELETE" })
export const moveMessage = (id: string, folder: string, uid: number, destination: string) => api(`${A(id)}/messages/${uid}/move`, { method: "POST", body: { folder, destination } })
export const sendMessage = (id: string, body: Outgoing) => api<{ message_id: string; warnings: string[] }>(`${A(id)}/send`, { method: "POST", body })
export const saveDraft = (id: string, body: Outgoing) => api<{ folder: string; uid: number | null }>(`${A(id)}/drafts`, { method: "POST", body })
export const attachmentUrl = (id: string, folder: string, uid: number, index: number, download = false) => `${A(id)}/messages/${uid}/attachments/${index}${qs({ folder, download: download ? 1 : undefined })}`

export const errorMessage = (e: unknown, fallback: string) => (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string" ? (e as { message: string }).message : fallback)

/* ─── Formatting ─── */

export const who = (list: Address[]) => list.map((a) => a.name || a.address).join(", ") || "—"
export const full = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address)
export const fullList = (list: Address[]) => list.map(full).join(", ")

const pad = (n: number) => String(n).padStart(2, "0")
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
/** Today → "14:05"; this year → "12 nov"; older → "12/11/2025". */
export const shortDate = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
export const longDate = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fileSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** "a@b.com, Juan <c@d.com>; e@f.com" → ["a@b.com", "c@d.com", "e@f.com"] */
export const parseAddresses = (value: string) =>
  value.split(/[,;\n]+/).map((part) => { const m = part.match(/<([^>]+)>/); return (m ? m[1] : part).trim() }).filter(Boolean)
export const validEmail = (v: string) => /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(v)

/* ─── Reply / forward ─── */

const stripSignature = (text: string) => { const i = text.lastIndexOf("\n-- \n"); return i >= 0 ? text.slice(0, i).replace(/\s+$/, "") : text }
const quote = (text: string) => text.replace(/\r\n/g, "\n").trimEnd().split("\n").map((l) => `> ${l}`).join("\n")
const prefixed = (prefix: string, subject: string) => (new RegExp(`^${prefix}\\s*:`, "i").test(subject) ? subject : `${prefix}: ${subject}`)

export interface ComposeState {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  in_reply_to: string | null
  references: string[]
  carried: { folder: string; uid: number; files: Attachment[]; skip: number[] } | null
  draft_uid: number | null
  reply_to: { folder: string; uid: number } | null
}

export const emptyCompose = (to = ""): ComposeState => ({ to, cc: "", bcc: "", subject: "", body: "", in_reply_to: null, references: [], carried: null, draft_uid: null, reply_to: null })

export const replyFrom = (m: Message, own: string, all: boolean): ComposeState => {
  const mine = (a: Address) => a.address.toLowerCase() === own.toLowerCase()
  const primary = (m.reply_to.length ? m.reply_to : m.from).filter((a) => !mine(a))
  const to = all ? [...primary, ...m.to.filter((a) => !mine(a))] : primary
  const cc = all ? m.cc.filter((a) => !mine(a)) : []
  const unique = (list: Address[]) => [...new Map(list.map((a) => [a.address.toLowerCase(), a])).values()]
  return {
    ...emptyCompose(),
    to: unique(to.length ? to : m.to).map(full).join(", "),
    cc: unique(cc).map(full).join(", "),
    subject: prefixed("Re", m.subject),
    body: `\n\nEl ${longDate(m.date)}, ${m.from.map(full).join(", ")} escribió:\n${quote(m.text)}`,
    in_reply_to: m.message_id,
    references: [...m.references, ...(m.message_id ? [m.message_id] : [])],
    reply_to: { folder: m.folder, uid: m.uid },
  }
}

export const forwardFrom = (m: Message): ComposeState => ({
  ...emptyCompose(),
  subject: prefixed("Rv", m.subject),
  body: `\n\n---------- Mensaje reenviado ----------\nDe: ${fullList(m.from)}\nFecha: ${longDate(m.date)}\nAsunto: ${m.subject}\nPara: ${fullList(m.to)}${m.cc.length ? `\nCC: ${fullList(m.cc)}` : ""}\n\n${m.text.trimEnd()}`,
  carried: m.attachments.length ? { folder: m.folder, uid: m.uid, files: m.attachments, skip: [] } : null,
})

export const fromDraft = (m: Message): ComposeState => ({
  to: fullList(m.to),
  cc: fullList(m.cc),
  bcc: fullList(m.bcc),
  subject: m.subject === "(sin asunto)" ? "" : m.subject,
  body: stripSignature(m.text),
  in_reply_to: m.in_reply_to,
  references: m.references,
  carried: m.attachments.length ? { folder: m.folder, uid: m.uid, files: m.attachments, skip: [] } : null,
  draft_uid: m.uid,
  reply_to: null,
})

export const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(",")[1] || "")
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

export const DEFAULT_ACCOUNT = (company: CompanyCode): MailAccountInput => ({
  company, label: "", email: "", display_name: company === "fabmetal" ? "FABMETAL" : "KARVEN Medical",
  imap_host: "", imap_port: 993, imap_secure: true, smtp_host: "", smtp_port: 465, smtp_secure: true,
  username: "", password: "", signature: "", active: true,
})

export const accountToInput = (a: MailAccount): MailAccountInput => ({
  company: a.company, label: a.label, email: a.email, display_name: a.display_name || "",
  imap_host: a.imap_host, imap_port: a.imap_port, imap_secure: a.imap_secure, smtp_host: a.smtp_host, smtp_port: a.smtp_port, smtp_secure: a.smtp_secure,
  username: a.username === a.email ? "" : a.username, password: "", signature: a.signature || "", active: a.active,
})
