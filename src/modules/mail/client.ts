import { randomBytes } from "node:crypto"
import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from "imapflow"
import { simpleParser, type AddressObject } from "mailparser"
import nodemailer from "nodemailer"
import sanitizeHtml from "sanitize-html"
import { decryptSecret } from "./service"

type Loose = Record<string, any>

/** Connection data of a mailbox (password already decrypted). */
export interface MailSettings {
  id?: string
  stamp?: string
  email: string
  display_name: string | null
  imap_host: string
  imap_port: number
  imap_secure: boolean
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  username: string
  password: string
  signature?: string | null
}

export type Special = "inbox" | "drafts" | "sent" | "junk" | "trash" | "archive"

export interface Folder { path: string; name: string; special: Special | null; messages: number; unseen: number }
export interface Address { name: string; address: string }
export interface MessageSummary { uid: number; subject: string; from: Address[]; to: Address[]; date: string | null; seen: boolean; flagged: boolean; answered: boolean; draft: boolean; has_attachments: boolean; size: number }

export interface Outgoing {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  in_reply_to?: string | null
  references?: string[] | null
  attachments?: { filename: string; content_type?: string | null; content_base64: string }[]
  /** Re-attach the files of another message (forward, or a draft being sent) */
  include_attachments_from?: { folder: string; uid: number; skip?: number[] } | null
}

export class MailError extends Error {}

export const settingsOf = (a: Loose): MailSettings => ({
  id: a.id, stamp: [a.imap_host, a.imap_port, a.imap_secure, a.username, a.password_enc].join("|"), email: a.email, display_name: a.display_name, imap_host: a.imap_host, imap_port: Number(a.imap_port) || 993, imap_secure: a.imap_secure !== false,
  smtp_host: a.smtp_host, smtp_port: Number(a.smtp_port) || 465, smtp_secure: a.smtp_secure !== false, username: a.username || a.email, password: decryptSecret(a.password_enc), signature: a.signature,
})

/** Human message for the usual connection failures (shown as is in the admin). */
export const friendlyError = (e: unknown, side: "IMAP" | "SMTP" = "IMAP"): string => {
  const err = e as Loose
  const text = `${err?.responseText || ""} ${err?.response || ""} ${err?.message || ""}`.trim()
  if (err?.authenticationFailed || err?.code === "EAUTH" || /auth|credential|login|535/i.test(text)) return `${side}: usuario o contraseña incorrectos`
  if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN" || /ENOTFOUND|EAI_AGAIN/.test(text)) return `${side}: no se encontró el servidor`
  if (err?.code === "ECONNREFUSED") return `${side}: el servidor rechazó la conexión (revise el puerto)`
  if (err?.code === "ETIMEDOUT" || err?.code === "ETIMEOUT" || /timeout/i.test(text)) return `${side}: el servidor no respondió a tiempo (revise host, puerto y SSL)`
  if (/certificate|self.signed|altname|CERT_/i.test(text) || /CERT/.test(String(err?.code || ""))) return `${side}: el certificado SSL del servidor no es válido para ese nombre`
  if (/wrong version number|ssl3_get_record|EPROTO/i.test(text) || err?.code === "EPROTO") return `${side}: no coincide el tipo de seguridad (pruebe SSL activado/desactivado según el puerto)`
  return `${side}: ${text || "error desconocido"}`.slice(0, 300)
}

/* ─── IMAP connections: one per mailbox, reused for a few minutes ─────────────────────────── */

const IDLE_MS = 3 * 60 * 1000
interface PoolEntry { stamp: string; client: Promise<ImapFlow>; timer?: NodeJS.Timeout; specials?: Map<Special, string> }
const pool = new Map<string, PoolEntry>()

const newClient = (s: MailSettings) => new ImapFlow({
  host: s.imap_host, port: s.imap_port, secure: s.imap_secure,
  auth: { user: s.username, pass: s.password },
  logger: false, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 120000,
  tls: { servername: s.imap_host },
})

const drop = (id: string) => {
  const hit = pool.get(id)
  if (!hit) return
  pool.delete(id)
  if (hit.timer) clearTimeout(hit.timer)
  hit.client.then((c) => c.logout().catch(() => c.close())).catch(() => {})
}

async function connection(s: MailSettings): Promise<{ client: ImapFlow; entry: PoolEntry }> {
  const id = s.id || s.email
  let entry = pool.get(id)
  if (entry && entry.stamp !== (s.stamp || "")) { drop(id); entry = undefined }
  if (entry) {
    const client = await entry.client.catch(() => null)
    if (client?.usable) { touch(id, entry); return { client, entry } }
    drop(id)
  }
  const client = newClient(s)
  const created: PoolEntry = { stamp: s.stamp || "", client: client.connect().then(() => client) }
  client.on("error", () => { if (pool.get(id) === created) drop(id) })
  client.on("close", () => { if (pool.get(id) === created) { pool.delete(id); if (created.timer) clearTimeout(created.timer) } })
  pool.set(id, created)
  try {
    await created.client
  } catch (e) {
    if (pool.get(id) === created) pool.delete(id)
    throw new MailError(friendlyError(e))
  }
  touch(id, created)
  return { client, entry: created }
}

const touch = (id: string, entry: PoolEntry) => {
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => drop(id), IDLE_MS)
  entry.timer.unref?.()
}

/** Runs `fn` with the mailbox selected; retries once on a dropped connection. */
async function withFolder<T>(s: MailSettings, path: string, fn: (client: ImapFlow, entry: PoolEntry) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const { client, entry } = await connection(s)
    let lock: { release: () => void } | null = null
    try {
      lock = await client.getMailboxLock(path)
      return await fn(client, entry)
    } catch (e) {
      const err = e as Loose
      const dropped = !client.usable || err?.code === "NoConnection" || err?.code === "EConnectionClosed"
      if (dropped && attempt === 0) { drop(s.id || s.email); continue }
      if (err instanceof MailError) throw err
      if (/nonexistent|doesn.t exist|not exist|Mailbox doesn|No such mailbox/i.test(`${err?.responseText || ""} ${err?.message || ""}`)) throw new MailError(`La carpeta "${path}" no existe`)
      throw new MailError(friendlyError(e))
    } finally {
      lock?.release()
    }
  }
}

/* ─── Folders ─────────────────────────────────────────────────────────────────────────────── */

const SPECIAL_USE: Record<string, Special> = { "\\Inbox": "inbox", "\\Drafts": "drafts", "\\Sent": "sent", "\\Junk": "junk", "\\Trash": "trash", "\\Archive": "archive" }
const guessSpecial = (path: string, delimiter: string): Special | null => {
  if (path.toUpperCase() === "INBOX") return "inbox"
  const leaf = (delimiter ? path.split(delimiter).pop() : path) || path
  if (/^(sent|sent items|sent messages|enviados|elementos enviados)$/i.test(leaf)) return "sent"
  if (/^(drafts?|borradores)$/i.test(leaf)) return "drafts"
  if (/^(trash|deleted|deleted items|deleted messages|papelera|elementos eliminados)$/i.test(leaf)) return "trash"
  if (/^(junk|spam|junk e-?mail|correo no deseado)$/i.test(leaf)) return "junk"
  if (/^(archive|archivo|archivos)$/i.test(leaf)) return "archive"
  return null
}
const SPECIAL_LABEL: Record<Special, string> = { inbox: "Recibidos", drafts: "Borradores", sent: "Enviados", junk: "Spam", trash: "Papelera", archive: "Archivo" }
const SPECIAL_ORDER: Special[] = ["inbox", "drafts", "sent", "archive", "junk", "trash"]

async function readFolders(client: ImapFlow, entry: PoolEntry): Promise<Folder[]> {
  const boxes = await client.list({ statusQuery: { messages: true, unseen: true } })
  const specials = new Map<Special, string>()
  const folders: Folder[] = []
  for (const b of boxes) {
    if (b.flags?.has("\\Noselect") || b.flags?.has("\\NonExistent")) continue
    let special = (b.specialUse && SPECIAL_USE[b.specialUse]) || guessSpecial(b.path, b.delimiter)
    if (special && specials.has(special)) special = null
    if (special) specials.set(special, b.path)
    const leaf = b.name || b.path
    folders.push({ path: b.path, name: special ? SPECIAL_LABEL[special] : leaf, special, messages: Number(b.status?.messages) || 0, unseen: Number(b.status?.unseen) || 0 })
  }
  entry.specials = specials
  const rank = (f: Folder) => (f.special ? SPECIAL_ORDER.indexOf(f.special) : 100)
  return folders.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "es"))
}

export async function listFolders(s: MailSettings): Promise<Folder[]> {
  return withFolder(s, "INBOX", (client, entry) => readFolders(client, entry))
}

/** Path of a special folder, creating Drafts/Sent/Trash when the server has none. */
async function specialPath(s: MailSettings, special: Special): Promise<string | null> {
  const { client, entry } = await connection(s)
  if (!entry.specials) await readFolders(client, entry)
  const found = entry.specials?.get(special)
  if (found) return found
  if (special !== "drafts" && special !== "sent" && special !== "trash") return null
  const name = { drafts: "Drafts", sent: "Sent", trash: "Trash" }[special]
  const boxes = await client.list()
  const delimiter = boxes.find((b) => b.path.toUpperCase() === "INBOX")?.delimiter || "/"
  // cPanel/Courier style servers keep every folder under "INBOX."
  const nested = boxes.some((b) => b.path.toUpperCase().startsWith(`INBOX${delimiter}`.toUpperCase()))
  const path = nested ? `INBOX${delimiter}${name}` : name
  try { await client.mailboxCreate(path) } catch { /* already there */ }
  entry.specials?.set(special, path)
  return path
}

/* ─── Messages ────────────────────────────────────────────────────────────────────────────── */

const addresses = (list: { name?: string; address?: string }[] | undefined): Address[] => (list || []).map((a) => ({ name: a.name || "", address: a.address || "" })).filter((a) => a.address || a.name)

const hasAttachments = (node: MessageStructureObject | undefined): boolean => {
  if (!node) return false
  if (node.disposition === "attachment") return true
  if (!/^(multipart|text)\//i.test(node.type || "") && (node.dispositionParameters?.filename || node.parameters?.name) && node.disposition !== "inline") return true
  return (node.childNodes || []).some(hasAttachments)
}

const summary = (m: FetchMessageObject): MessageSummary => ({
  uid: m.uid,
  subject: m.envelope?.subject || "(sin asunto)",
  from: addresses(m.envelope?.from),
  to: addresses(m.envelope?.to),
  date: (m.envelope?.date || m.internalDate) ? new Date((m.envelope?.date || m.internalDate) as Date).toISOString() : null,
  seen: !!m.flags?.has("\\Seen"),
  flagged: !!m.flags?.has("\\Flagged"),
  answered: !!m.flags?.has("\\Answered"),
  draft: !!m.flags?.has("\\Draft"),
  has_attachments: hasAttachments(m.bodyStructure),
  size: Number(m.size) || 0,
})

export async function listMessages(s: MailSettings, folder: string, opts: { page?: number; size?: number; q?: string }) {
  const size = Math.min(Math.max(opts.size || 40, 10), 100)
  const page = Math.max(opts.page || 0, 0)
  return withFolder(s, folder, async (client) => {
    const box = client.mailbox
    const exists = box ? Number(box.exists) || 0 : 0
    const q = (opts.q || "").trim()
    const query = { uid: true, envelope: true, flags: true, internalDate: true, size: true, bodyStructure: true }
    const items: MessageSummary[] = []
    let total = exists
    if (q) {
      const found = (await client.search({ or: [{ from: q }, { to: q }, { cc: q }, { subject: q }] }, { uid: true })) || []
      const uids = [...found].sort((a, b) => b - a)
      total = uids.length
      const slice = uids.slice(page * size, page * size + size)
      if (slice.length) for await (const m of client.fetch(slice.join(","), query, { uid: true })) items.push(summary(m))
    } else if (exists > 0) {
      const to = exists - page * size
      if (to >= 1) {
        const from = Math.max(1, to - size + 1)
        for await (const m of client.fetch(`${from}:${to}`, query)) items.push(summary(m))
      }
    }
    items.sort((a, b) => b.uid - a.uid)
    return { messages: items, total, page, size, unseen: Number(box && (box as Loose).unseen) || undefined }
  })
}

const flatAddresses = (v: AddressObject | AddressObject[] | undefined): Address[] => (Array.isArray(v) ? v : v ? [v] : []).flatMap((a) => addresses(a.value as { name?: string; address?: string }[]))

/** Email HTML made safe for a sandboxed iframe; remote images are blocked until the user asks for them. */
export function cleanHtml(html: string, allowRemote: boolean) {
  let blocked = 0
  const clean = sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "style", "center", "font", "span", "div", "u", "s", "small", "big", "sup", "sub", "h1", "h2", "colgroup", "col", "hr"],
    allowVulnerableTags: true,
    allowedAttributes: {
      "*": ["style", "class", "align", "valign", "width", "height", "bgcolor", "color", "border", "cellpadding", "cellspacing", "dir", "title", "face", "size", "colspan", "rowspan", "lang", "role"],
      a: ["href", "name", "target", "rel", "title", "style"],
      img: ["src", "alt", "width", "height", "title", "style", "border"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
      img: (tagName, attribs) => {
        if (!allowRemote && /^https?:/i.test(attribs.src || "")) { blocked += 1; return { tagName, attribs: { style: "display:none", alt: "" } } }
        return { tagName, attribs }
      },
    },
  })
  // Remote backgrounds in inline CSS would also load (and track) when images are blocked.
  const html2 = allowRemote ? clean : clean.replace(/url\(\s*(['"]?)https?:[^)]*\)/gi, () => { blocked += 1; return "none" })
  return { html: html2, blocked }
}

/** Plain text of an HTML-only email (used to quote it in replies and forwards). */
export const htmlToText = (html: string) => {
  const withBreaks = html
    .replace(/<(style|head)[^>]*>[\s\S]*?<\/(style|head)>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|blockquote|table)>/gi, "\n")
  const stripped = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
  return stripped
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

const textToHtml = (text: string) => {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const out: string[] = []
  let quote: string[] = []
  const flush = () => { if (quote.length) { out.push(`<blockquote style="margin:0 0 0 4px;padding-left:10px;border-left:3px solid #d0d7de;color:#57606a">${quote.join("<br>")}</blockquote>`); quote = [] } }
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (/^>/.test(line)) { quote.push(esc(line.replace(/^>\s?/, "")) || "&nbsp;"); continue }
    flush()
    out.push(esc(line).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>') || "")
  }
  flush()
  return out.join("<br>")
}

export async function getMessage(s: MailSettings, folder: string, uid: number, opts: { images?: boolean; markSeen?: boolean } = {}) {
  return withFolder(s, folder, async (client) => {
    const m = await client.fetchOne(String(uid), { uid: true, flags: true, source: true }, { uid: true })
    if (!m || !m.source) throw new MailError("El mensaje ya no existe en esta carpeta")
    const parsed = await simpleParser(m.source)
    if (opts.markSeen !== false && !m.flags?.has("\\Seen")) await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {})
    const { html, blocked } = parsed.html ? cleanHtml(parsed.html, !!opts.images) : { html: parsed.text ? textToHtml(parsed.text) : "", blocked: 0 }
    const refs = parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : []
    return {
      uid,
      folder,
      subject: parsed.subject || "(sin asunto)",
      from: flatAddresses(parsed.from),
      to: flatAddresses(parsed.to),
      cc: flatAddresses(parsed.cc),
      bcc: flatAddresses(parsed.bcc),
      reply_to: flatAddresses(parsed.replyTo),
      date: parsed.date ? parsed.date.toISOString() : null,
      message_id: parsed.messageId || null,
      in_reply_to: parsed.inReplyTo || null,
      references: refs,
      html,
      text: parsed.text || (parsed.html ? htmlToText(parsed.html) : ""),
      remote_images_blocked: blocked,
      seen: true,
      flagged: !!m.flags?.has("\\Flagged"),
      answered: !!m.flags?.has("\\Answered"),
      draft: !!m.flags?.has("\\Draft"),
      attachments: parsed.attachments
        .map((a, index) => ({ index, filename: a.filename || `adjunto-${index + 1}`, content_type: a.contentType, size: a.size, related: !!a.related }))
        .filter((a) => !a.related)
        .map(({ related, ...a }) => a),
    }
  })
}

export async function getAttachment(s: MailSettings, folder: string, uid: number, index: number) {
  return withFolder(s, folder, async (client) => {
    const m = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true })
    if (!m || !m.source) throw new MailError("El mensaje ya no existe en esta carpeta")
    const a = (await simpleParser(m.source)).attachments[index]
    if (!a) throw new MailError("Adjunto no encontrado")
    return { filename: a.filename || `adjunto-${index + 1}`, content_type: a.contentType || "application/octet-stream", content: a.content }
  })
}

export async function setFlags(s: MailSettings, folder: string, uid: number, flags: { seen?: boolean; flagged?: boolean }) {
  return withFolder(s, folder, async (client) => {
    const range = String(uid)
    if (flags.seen === true) await client.messageFlagsAdd(range, ["\\Seen"], { uid: true })
    if (flags.seen === false) await client.messageFlagsRemove(range, ["\\Seen"], { uid: true })
    if (flags.flagged === true) await client.messageFlagsAdd(range, ["\\Flagged"], { uid: true })
    if (flags.flagged === false) await client.messageFlagsRemove(range, ["\\Flagged"], { uid: true })
    return { ok: true }
  })
}

/** Moves to the trash; inside the trash (or with `permanent`) deletes for good. */
export async function removeMessage(s: MailSettings, folder: string, uid: number, permanent = false) {
  const trash = await specialPath(s, "trash")
  return withFolder(s, folder, async (client) => {
    if (permanent || !trash || trash === folder) { await client.messageDelete(String(uid), { uid: true }); return { deleted: true, moved_to: null } }
    await client.messageMove(String(uid), trash, { uid: true })
    return { deleted: false, moved_to: trash }
  })
}

export async function moveMessage(s: MailSettings, folder: string, uid: number, destination: string) {
  return withFolder(s, folder, async (client) => { await client.messageMove(String(uid), destination, { uid: true }); return { moved_to: destination } })
}

/* ─── Compose, send and drafts ────────────────────────────────────────────────────────────── */

const clean = (list?: string[]) => (list || []).map((v) => v.trim()).filter(Boolean)

async function attachmentsFor(s: MailSettings, msg: Outgoing) {
  const files: { filename: string; content: Buffer; contentType?: string }[] = (msg.attachments || []).map((a) => ({ filename: a.filename, content: Buffer.from(a.content_base64, "base64"), contentType: a.content_type || undefined }))
  const src = msg.include_attachments_from
  if (src) {
    const skip = new Set(src.skip || [])
    const original = await withFolder(s, src.folder, async (client) => {
      const m = await client.fetchOne(String(src.uid), { uid: true, source: true }, { uid: true })
      return m && m.source ? simpleParser(m.source) : null
    })
    original?.attachments.forEach((a, i) => { if (!a.related && !skip.has(i)) files.push({ filename: a.filename || `adjunto-${i + 1}`, content: a.content, contentType: a.contentType }) })
  }
  return files
}

/** RFC 822 source of the message; with Bcc for the copy kept in Sent/Drafts, without it for the wire. */
async function compose(s: MailSettings, msg: Outgoing, keepBcc: boolean, ids: { messageId: string; date: Date }, files: { filename: string; content: Buffer; contentType?: string }[]) {
  const signature = (s.signature || "").trim()
  const text = signature ? `${msg.body}\n\n-- \n${signature}` : msg.body
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2328">${textToHtml(msg.body)}${signature ? `<br><br><div style="color:#57606a">${textToHtml(signature)}</div>` : ""}</div>`
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" })
  const info = await transport.sendMail({
    from: { name: s.display_name || "", address: s.email },
    to: clean(msg.to), cc: clean(msg.cc), bcc: keepBcc ? clean(msg.bcc) : undefined,
    subject: msg.subject, text, html,
    inReplyTo: msg.in_reply_to || undefined, references: msg.references?.length ? msg.references : undefined,
    messageId: ids.messageId, date: ids.date,
    attachments: files,
  })
  return info.message as Buffer
}

const newIds = (s: MailSettings) => ({ messageId: `<${Date.now().toString(36)}.${randomBytes(6).toString("hex")}@${s.email.split("@")[1] || "localhost"}>`, date: new Date() })

const smtp = (s: MailSettings) => nodemailer.createTransport({
  host: s.smtp_host, port: s.smtp_port, secure: s.smtp_secure,
  auth: { user: s.username, pass: s.password },
  connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 60000,
  tls: { servername: s.smtp_host },
})

export async function sendMessage(s: MailSettings, msg: Outgoing, extra: { draft_uid?: number | null; reply_to?: { folder: string; uid: number } | null } = {}) {
  const recipients = [...clean(msg.to), ...clean(msg.cc), ...clean(msg.bcc)]
  if (!recipients.length) throw new MailError("Agregue al menos un destinatario")
  const ids = newIds(s)
  const files = await attachmentsFor(s, msg)
  const wire = await compose(s, msg, false, ids, files)
  try {
    await smtp(s).sendMail({ envelope: { from: s.email, to: recipients }, raw: wire })
  } catch (e) {
    throw new MailError(friendlyError(e, "SMTP"))
  }
  // Bookkeeping on the IMAP side; the message is already gone, so failures here are only reported.
  const warnings: string[] = []
  try {
    const sent = await specialPath(s, "sent")
    if (sent) { const copy = await compose(s, msg, true, ids, files); await withFolder(s, sent, (client) => client.append(sent, copy, ["\\Seen"], ids.date)) }
  } catch (e) { warnings.push(`No se pudo guardar la copia en Enviados (${e instanceof Error ? e.message : String(e)})`) }
  if (extra.draft_uid) {
    try { const drafts = await specialPath(s, "drafts"); if (drafts) await withFolder(s, drafts, (client) => client.messageDelete(String(extra.draft_uid), { uid: true })) } catch { warnings.push("No se pudo borrar el borrador") }
  }
  if (extra.reply_to) {
    try { await withFolder(s, extra.reply_to.folder, (client) => client.messageFlagsAdd(String(extra.reply_to!.uid), ["\\Answered"], { uid: true })) } catch { /* original moved or deleted */ }
  }
  return { message_id: ids.messageId, warnings }
}

/** Saves (or replaces) a draft in the Drafts folder; returns its new uid. */
export async function saveDraft(s: MailSettings, msg: Outgoing, replaceUid?: number | null) {
  const drafts = await specialPath(s, "drafts")
  if (!drafts) throw new MailError("El servidor no tiene carpeta de borradores")
  const ids = newIds(s)
  const files = await attachmentsFor(s, msg)
  const raw = await compose(s, msg, true, ids, files)
  return withFolder(s, drafts, async (client) => {
    const res = await client.append(drafts, raw, ["\\Draft", "\\Seen"], ids.date)
    if (replaceUid) await client.messageDelete(String(replaceUid), { uid: true }).catch(() => {})
    return { folder: drafts, uid: res ? res.uid ?? null : null }
  })
}

/** Checks both sides with the given settings (used before saving an account). */
export async function testSettings(s: MailSettings) {
  const result: { imap: string | null; smtp: string | null; folders: number } = { imap: null, smtp: null, folders: 0 }
  const client = newClient(s)
  client.on("error", () => {})
  try {
    await client.connect()
    result.folders = (await client.list()).length
  } catch (e) {
    result.imap = friendlyError(e, "IMAP")
  } finally {
    await client.logout().catch(() => client.close())
  }
  try { await smtp(s).verify() } catch (e) { result.smtp = friendlyError(e, "SMTP") }
  return result
}

/** Forget the cached connection (account edited or deleted). */
export const forget = (id: string) => drop(id)
