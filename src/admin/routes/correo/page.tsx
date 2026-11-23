import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowDownTray, ArrowLeft, ArrowPath, ArrowUturnLeft, CogSixTooth, Envelope, ForwardSolid, PaperClip, PencilSquare, Photo, Star, StarSolid, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Input, Select, Text, Tooltip, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import MailCompose from "../../components/mail-compose"
import { companyLabel, useCompany } from "../../lib/companies"
import {
  attachmentUrl, emptyCompose, errorMessage, fileSize, forwardFrom, fromDraft, fullList, getMessage, listAccounts, listFolders, listMessages, longDate, moveMessage, removeMessage, replyFrom, setFlags, shortDate, who,
  type ComposeState, type Folder, type MailAccount, type Message, type MessageList,
} from "../../lib/mail"

const ACCOUNT_KEY = "karven.mail.account"

/** Sanitised email HTML inside a sandboxed frame (no scripts); grows to its content height. */
function MailBody({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(240)
  const doc = useMemo(() => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'"><base target="_blank"><style>body{margin:0;padding:4px 2px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2328;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}blockquote{margin:0 0 0 4px;padding-left:10px;border-left:3px solid #d0d7de;color:#57606a}</style></head><body>${html}</body></html>`, [html])
  const measure = () => { try { const h = frame.current?.contentDocument?.documentElement?.scrollHeight; if (h) setHeight(Math.min(Math.max(h + 16, 120), 20000)) } catch { /* cross-origin */ } }
  return <iframe ref={frame} title="Contenido del correo" srcDoc={doc} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" onLoad={() => { measure(); setTimeout(measure, 400) }} style={{ height }} className="w-full rounded-md border border-ui-border-base bg-white" />
}

/** /correo — company mailboxes (IMAP/SMTP). Everything happens on the mail server, so Outlook and phones stay in sync. */
const MailPage = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [company] = useCompany()
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null)
  const [accountId, setAccountId] = useState<string>(() => { try { return localStorage.getItem(ACCOUNT_KEY) || "" } catch { return "" } })
  const [folders, setFolders] = useState<Folder[]>([])
  const [folder, setFolder] = useState("INBOX")
  const [list, setList] = useState<MessageList | null>(null)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState(params.get("q") || "")
  const [query, setQuery] = useState(params.get("q") || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [opening, setOpening] = useState<number | null>(null)
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [tick, setTick] = useState(0)

  const account = accounts?.find((a) => a.id === accountId) || null
  const current = folders.find((f) => f.path === folder)
  const special = current?.special || null
  const outgoing = special === "sent" || special === "drafts"

  // Accounts of the company selected in the header.
  useEffect(() => {
    listAccounts(company === "all" ? undefined : company).then(({ accounts }) => {
      const active = accounts.filter((a) => a.active)
      setAccounts(active)
      setAccountId((prev) => (active.some((a) => a.id === prev) ? prev : active[0]?.id || ""))
    }).catch((e) => { setAccounts([]); toast.error(errorMessage(e, "No se pudieron cargar las cuentas")) })
  }, [company])

  useEffect(() => { try { if (accountId) localStorage.setItem(ACCOUNT_KEY, accountId) } catch { /* private mode */ } setFolder("INBOX"); setMessage(null); setPage(0) }, [accountId])

  const loadFolders = useCallback(() => {
    if (!accountId) return
    listFolders(accountId).then(({ folders }) => { setFolders(folders); setError(null) }).catch((e) => { setFolders([]); setError(errorMessage(e, "No se pudo conectar con el servidor de correo")) })
  }, [accountId])
  useEffect(() => { loadFolders() }, [loadFolders, tick])

  useEffect(() => {
    if (!accountId) return
    setLoading(true)
    listMessages(accountId, folder, page, query).then((r) => { setList(r); setError(null) }).catch((e) => { setList(null); setError(errorMessage(e, "No se pudo leer la carpeta")) }).finally(() => setLoading(false))
  }, [accountId, folder, page, query, tick])

  // Search: debounce and keep ?q= in the URL (links from Clientes / Proveedores use it).
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); setQuery(q.trim()); const next = new URLSearchParams(params); if (q.trim()) next.set("q", q.trim()); else next.delete("q"); setParams(next, { replace: true }) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const refresh = () => setTick((n) => n + 1)
  const pickFolder = (path: string) => { setFolder(path); setPage(0); setMessage(null) }

  const open = async (uid: number, images = false) => {
    if (!account) return
    setOpening(uid)
    try {
      const { message } = await getMessage(account.id, folder, uid, images)
      if (special === "drafts") { setCompose(fromDraft(message)); return }
      setMessage(message)
      setList((l) => (l ? { ...l, messages: l.messages.map((m) => (m.uid === uid ? { ...m, seen: true } : m)) } : l))
      setFolders((fs) => fs.map((f) => (f.path === folder && list?.messages.find((m) => m.uid === uid && !m.seen) ? { ...f, unseen: Math.max(0, f.unseen - 1) } : f)))
    } catch (e) { toast.error(errorMessage(e, "No se pudo abrir el mensaje")) } finally { setOpening(null) }
  }

  const act = async (fn: () => Promise<unknown>, done: string, close = false) => {
    try { await fn(); toast.success(done); if (close) setMessage(null); refresh() } catch (e) { toast.error(errorMessage(e, "No se pudo completar")) }
  }

  const inTrash = special === "trash"
  const inbox = folders.find((f) => f.special === "inbox")?.path || "INBOX"
  const pages = list ? Math.max(1, Math.ceil(list.total / list.size)) : 1

  if (accounts && accounts.length === 0) {
    return (
      <Container className="flex flex-col items-start gap-3 p-8">
        <Heading level="h1">Correo</Heading>
        <Text className="text-ui-fg-subtle">{company === "all" ? "Todavía no hay cuentas de correo conectadas." : `${companyLabel(company)} todavía no tiene cuentas de correo conectadas.`} Conecte el buzón que ya usan (por ejemplo contact@karvenmedical.com) para leer y enviar desde aquí.</Text>
        <Button size="small" onClick={() => navigate("/correo/cuentas")}><CogSixTooth /> Conectar una cuenta</Button>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <Heading level="h1">Correo</Heading>
          {accounts && accounts.length > 0 && (
            <Select size="small" value={accountId} onValueChange={setAccountId}>
              <Select.Trigger className="min-w-[16rem]"><Select.Value placeholder="Cuenta" /></Select.Trigger>
              <Select.Content>{accounts.map((a) => <Select.Item key={a.id} value={a.id}>{a.label} · {a.email}</Select.Item>)}</Select.Content>
            </Select>
          )}
        </div>
        <div className="flex gap-2">
          <Tooltip content="Actualizar"><IconButton size="small" variant="transparent" onClick={refresh}><ArrowPath /></IconButton></Tooltip>
          <Button size="small" variant="secondary" onClick={() => navigate("/correo/cuentas")}><CogSixTooth /> Cuentas</Button>
          <Button size="small" onClick={() => setCompose(emptyCompose())} disabled={!account}><PencilSquare /> Redactar</Button>
        </div>
      </div>

      {error && <div className="bg-ui-bg-subtle px-6 py-3"><Text size="small" className="text-ui-fg-error">{error}</Text><Text size="xsmall" className="text-ui-fg-subtle">Revise los datos de la cuenta en Cuentas o vuelva a intentarlo.</Text></div>}

      <div className="grid grid-cols-1 lg:min-h-[70vh] lg:grid-cols-[12rem_minmax(18rem,24rem)_1fr]">
        {/* Folders */}
        <nav className="flex items-center gap-1 overflow-x-auto lg:items-stretch border-b border-ui-border-base p-3 lg:flex-col lg:border-b-0 lg:border-r">
          {folders.map((f) => (
            <button key={f.path} type="button" onClick={() => pickFolder(f.path)} className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm ${f.path === folder ? "bg-ui-bg-base-pressed font-medium text-ui-fg-base" : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"}`}>
              <span className="truncate">{f.name}</span>
              {f.special === "drafts" ? (f.messages ? <span className="text-xs text-ui-fg-muted">{f.messages}</span> : null) : f.unseen ? <Badge size="2xsmall" color="blue">{f.unseen}</Badge> : null}
            </button>
          ))}
        </nav>

        {/* List */}
        <section className={`flex min-w-0 flex-col border-b border-ui-border-base lg:border-b-0 lg:border-r ${message ? "hidden lg:flex" : ""}`}>
          <div className="p-3"><Input size="small" type="search" placeholder="Buscar remitente, destinatario o asunto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <ul className="flex-1 overflow-y-auto">
            {loading && !list && <li className="px-4 py-6"><Text size="small" className="text-ui-fg-subtle">Cargando…</Text></li>}
            {list && list.messages.length === 0 && <li className="px-4 py-6"><Text size="small" className="text-ui-fg-subtle">{query ? "Sin resultados." : "No hay mensajes en esta carpeta."}</Text></li>}
            {list?.messages.map((m) => (
              <li key={m.uid}>
                <button type="button" onClick={() => open(m.uid)} className={`flex w-full flex-col gap-0.5 border-b border-ui-border-base px-4 py-2.5 text-left hover:bg-ui-bg-base-hover ${message?.uid === m.uid ? "bg-ui-bg-base-pressed" : ""} ${opening === m.uid ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2">
                    {!m.seen && !outgoing && <span className="h-2 w-2 shrink-0 rounded-full bg-ui-fg-interactive" />}
                    <span className={`flex-1 truncate text-sm ${m.seen || outgoing ? "text-ui-fg-subtle" : "font-semibold text-ui-fg-base"}`}>{outgoing ? `Para: ${who(m.to)}` : who(m.from)}</span>
                    {m.flagged && <StarSolid className="h-3.5 w-3.5 shrink-0 text-ui-tag-orange-icon" />}
                    {m.has_attachments && <PaperClip className="h-3.5 w-3.5 shrink-0 text-ui-fg-muted" />}
                    <span className="shrink-0 text-xs text-ui-fg-muted">{shortDate(m.date)}</span>
                  </div>
                  <span className={`truncate text-sm ${m.seen || outgoing ? "text-ui-fg-subtle" : "font-medium text-ui-fg-base"}`}>{m.answered ? "↩ " : ""}{m.subject}</span>
                </button>
              </li>
            ))}
          </ul>
          {list && list.total > list.size && (
            <div className="flex items-center justify-between px-4 py-2">
              <Button size="small" variant="transparent" disabled={page === 0} onClick={() => setPage(page - 1)}>Más recientes</Button>
              <Text size="xsmall" className="text-ui-fg-muted">{page + 1} de {pages}</Text>
              <Button size="small" variant="transparent" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Anteriores</Button>
            </div>
          )}
        </section>

        {/* Reader */}
        <section className={`min-w-0 p-4 lg:p-6 ${message ? "" : "hidden lg:block"}`}>
          {!message ? (
            <div className="flex h-full items-center justify-center"><Text size="small" className="text-ui-fg-muted">{special === "drafts" ? "Abra un borrador para seguir escribiéndolo." : "Seleccione un mensaje para leerlo."}</Text></div>
          ) : (
            <article className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1">
                <Button size="small" variant="transparent" className="lg:hidden" onClick={() => setMessage(null)}><ArrowLeft /> Volver</Button>
                <Button size="small" variant="secondary" onClick={() => account && setCompose(replyFrom(message, account.email, false))}><ArrowUturnLeft /> Responder</Button>
                <Button size="small" variant="secondary" onClick={() => account && setCompose(replyFrom(message, account.email, true))}>Responder a todos</Button>
                <Button size="small" variant="secondary" onClick={() => setCompose(forwardFrom(message))}><ForwardSolid /> Reenviar</Button>
                <span className="flex-1" />
                <Tooltip content={message.flagged ? "Quitar destacado" : "Destacar"}><IconButton size="small" variant="transparent" onClick={() => account && act(async () => { await setFlags(account.id, folder, message.uid, { flagged: !message.flagged }); setMessage({ ...message, flagged: !message.flagged }) }, message.flagged ? "Destacado quitado" : "Destacado")}>{message.flagged ? <StarSolid className="text-ui-tag-orange-icon" /> : <Star />}</IconButton></Tooltip>
                <Tooltip content="Marcar como no leído"><IconButton size="small" variant="transparent" onClick={() => account && act(() => setFlags(account.id, folder, message.uid, { seen: false }), "Marcado como no leído", true)}><Envelope /></IconButton></Tooltip>
                {(inTrash || special === "junk") && <Button size="small" variant="transparent" onClick={() => account && act(() => moveMessage(account.id, folder, message.uid, inbox), "Movido a Recibidos", true)}>Mover a Recibidos</Button>}
                <Tooltip content={inTrash ? "Eliminar definitivamente" : "Mover a la papelera"}>
                  <IconButton size="small" variant="transparent" onClick={() => { if (!account) return; if (inTrash && !window.confirm("¿Eliminar este mensaje definitivamente? No se puede deshacer.")) return; act(() => removeMessage(account.id, folder, message.uid, inTrash), inTrash ? "Eliminado definitivamente" : "Movido a la papelera", true) }}><Trash /></IconButton>
                </Tooltip>
              </div>

              <div>
                <Heading level="h2" className="break-words">{message.subject}</Heading>
                <div className="mt-2 grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-0.5 text-sm">
                  <span className="text-ui-fg-muted">De</span><span className="break-words">{fullList(message.from)}</span>
                  <span className="text-ui-fg-muted">Para</span><span className="break-words">{fullList(message.to) || "—"}</span>
                  {message.cc.length > 0 && <><span className="text-ui-fg-muted">CC</span><span className="break-words">{fullList(message.cc)}</span></>}
                  {message.bcc.length > 0 && <><span className="text-ui-fg-muted">CCO</span><span className="break-words">{fullList(message.bcc)}</span></>}
                  <span className="text-ui-fg-muted">Fecha</span><span>{longDate(message.date)}</span>
                </div>
              </div>

              {message.remote_images_blocked > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-ui-bg-subtle px-3 py-2">
                  <Text size="small" className="text-ui-fg-subtle">Las imágenes externas están ocultas para proteger su privacidad.</Text>
                  <Button size="small" variant="secondary" onClick={() => open(message.uid, true)}><Photo /> Mostrar imágenes</Button>
                </div>
              )}

              {message.attachments.length > 0 && account && (
                <ul className="flex flex-wrap gap-2">
                  {message.attachments.map((a) => (
                    <li key={a.index} className="flex items-center gap-2 rounded-md border border-ui-border-base px-2.5 py-1.5 text-sm">
                      <PaperClip className="text-ui-fg-muted" />
                      <a href={attachmentUrl(account.id, folder, message.uid, a.index)} target="_blank" rel="noreferrer" className="max-w-[16rem] truncate text-ui-fg-interactive hover:underline">{a.filename}</a>
                      <span className="text-xs text-ui-fg-muted">{fileSize(a.size)}</span>
                      <a href={attachmentUrl(account.id, folder, message.uid, a.index, true)} title="Descargar" className="text-ui-fg-muted hover:text-ui-fg-base"><ArrowDownTray /></a>
                    </li>
                  ))}
                </ul>
              )}

              <MailBody html={message.html} />
            </article>
          )}
        </section>
      </div>

      {compose && account && <MailCompose account={account} initial={compose} onClose={(changed) => { setCompose(null); if (changed) refresh() }} />}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Correo", icon: Envelope })

export default MailPage
