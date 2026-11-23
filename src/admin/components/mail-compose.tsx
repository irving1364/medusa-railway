import { Button, FocusModal, Heading, IconButton, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { PaperClip, XMark } from "@medusajs/icons"
import { useEffect, useRef, useState } from "react"
import { errorMessage, fileSize, fileToBase64, parseAddresses, saveDraft, sendMessage, validEmail, type ComposeState, type MailAccount, type Outgoing } from "../lib/mail"

const MAX_TOTAL = 25 * 1024 * 1024

interface Props {
  account: MailAccount
  initial: ComposeState | null
  onClose: (changed: boolean) => void
}

/** New message, reply, forward or draft. Plain text body; the server adds the signature and an HTML version. */
export default function MailCompose({ account, initial, onClose }: Props) {
  const [value, setValue] = useState<ComposeState | null>(initial)
  const [files, setFiles] = useState<File[]>([])
  const [showCc, setShowCc] = useState(false)
  const [busy, setBusy] = useState<"send" | "draft" | null>(null)
  const [dirty, setDirty] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(initial); setFiles([]); setDirty(false); setShowCc(!!(initial?.cc || initial?.bcc)) }, [initial])
  if (!value) return null

  const set = <K extends keyof ComposeState>(k: K, v: ComposeState[K]) => { setValue({ ...value, [k]: v }); setDirty(true) }
  const carried = value.carried ? value.carried.files.filter((f) => !value.carried!.skip.includes(f.index)) : []
  const total = files.reduce((s, f) => s + f.size, 0) + carried.reduce((s, f) => s + f.size, 0)

  const build = async (): Promise<Outgoing | null> => {
    const to = parseAddresses(value.to), cc = parseAddresses(value.cc), bcc = parseAddresses(value.bcc)
    const wrong = [...to, ...cc, ...bcc].find((a) => !validEmail(a))
    if (wrong) { toast.error(`Correo no válido: ${wrong}`); return null }
    if (total > MAX_TOTAL) { toast.error(`Los adjuntos suman ${fileSize(total)}; el máximo es 25 MB`); return null }
    const attachments = await Promise.all(files.map(async (f) => ({ filename: f.name, content_type: f.type || null, content_base64: await fileToBase64(f) })))
    return {
      to, cc, bcc, subject: value.subject.trim(), body: value.body,
      in_reply_to: value.in_reply_to, references: value.references.length ? value.references : null,
      attachments,
      include_attachments_from: value.carried ? { folder: value.carried.folder, uid: value.carried.uid, skip: value.carried.skip } : null,
      draft_uid: value.draft_uid, reply_to: value.reply_to,
    }
  }

  const send = async () => {
    if (!parseAddresses(value.to).length && !parseAddresses(value.cc).length && !parseAddresses(value.bcc).length) { toast.error("Agregue al menos un destinatario"); return }
    if (!value.subject.trim() && !window.confirm("El mensaje no tiene asunto. ¿Enviarlo igual?")) return
    const body = await build(); if (!body) return
    setBusy("send")
    try {
      const res = await sendMessage(account.id, body)
      toast.success("Mensaje enviado")
      res.warnings.forEach((w) => toast.warning(w))
      onClose(true)
    } catch (e) { toast.error(errorMessage(e, "No se pudo enviar")) } finally { setBusy(null) }
  }

  const draft = async () => {
    const body = await build(); if (!body) return
    setBusy("draft")
    try {
      const res = await saveDraft(account.id, body)
      toast.success("Borrador guardado en Borradores")
      // From now on the draft on the server carries every attachment.
      setValue({ ...value, draft_uid: res.uid, carried: res.uid ? { folder: res.folder, uid: res.uid, files: [], skip: [] } : value.carried })
      setFiles([]); setDirty(false)
      onClose(true)
    } catch (e) { toast.error(errorMessage(e, "No se pudo guardar el borrador")) } finally { setBusy(null) }
  }

  const close = () => { if (dirty && !window.confirm("¿Descartar los cambios de este mensaje?")) return; onClose(false) }

  return (
    <FocusModal open onOpenChange={(o) => { if (!o) close() }}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button size="small" variant="secondary" onClick={draft} isLoading={busy === "draft"} disabled={!!busy}>Guardar borrador</Button>
            <Button size="small" onClick={send} isLoading={busy === "send"} disabled={!!busy}>Enviar</Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>Correo</FocusModal.Title>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-3xl flex-col gap-4 px-6">
            <Heading level="h2">{value.reply_to ? "Responder" : value.draft_uid ? "Borrador" : value.carried && !value.draft_uid ? "Reenviar" : "Nuevo mensaje"}</Heading>
            <Text size="small" className="text-ui-fg-subtle">De: {account.display_name ? `${account.display_name} <${account.email}>` : account.email}</Text>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between"><Label size="small">Para</Label>{!showCc && <button type="button" className="text-xs text-ui-fg-interactive" onClick={() => setShowCc(true)}>CC / CCO</button>}</div>
              <Input size="small" value={value.to} onChange={(e) => set("to", e.target.value)} placeholder="cliente@empresa.com, otro@empresa.com" autoFocus={!value.to} />
            </div>
            {showCc && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1"><Label size="small">CC</Label><Input size="small" value={value.cc} onChange={(e) => set("cc", e.target.value)} /></div>
                <div className="flex flex-col gap-1"><Label size="small">CCO (oculto)</Label><Input size="small" value={value.bcc} onChange={(e) => set("bcc", e.target.value)} /></div>
              </div>
            )}
            <div className="flex flex-col gap-1"><Label size="small">Asunto</Label><Input size="small" value={value.subject} onChange={(e) => set("subject", e.target.value)} /></div>
            <div className="flex flex-col gap-1">
              <Label size="small">Mensaje</Label>
              <Textarea rows={16} value={value.body} onChange={(e) => set("body", e.target.value)} autoFocus={!!value.to} className="font-sans" />
              {account.signature ? <Text size="xsmall" className="whitespace-pre-line text-ui-fg-muted">Firma que se agrega al enviar:{"\n"}{account.signature}</Text> : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Button size="small" variant="secondary" type="button" onClick={() => fileInput.current?.click()}><PaperClip /> Adjuntar archivos</Button>
                <Text size="xsmall" className="text-ui-fg-muted">{total ? `${fileSize(total)} de 25 MB` : "Máximo 25 MB en total"}</Text>
                <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { const list = Array.from(e.target.files || []); if (list.length) { setFiles([...files, ...list]); setDirty(true) } e.target.value = "" }} />
              </div>
              {(carried.length > 0 || files.length > 0) && (
                <ul className="flex flex-wrap gap-2">
                  {carried.map((f) => (
                    <li key={`c${f.index}`} className="flex items-center gap-1 rounded-md border border-ui-border-base px-2 py-1 text-xs">
                      {f.filename} <span className="text-ui-fg-muted">· {fileSize(f.size)}</span>
                      <IconButton size="2xsmall" variant="transparent" onClick={() => set("carried", { ...value.carried!, skip: [...value.carried!.skip, f.index] })}><XMark /></IconButton>
                    </li>
                  ))}
                  {files.map((f, i) => (
                    <li key={`n${i}`} className="flex items-center gap-1 rounded-md border border-ui-border-base px-2 py-1 text-xs">
                      {f.name} <span className="text-ui-fg-muted">· {fileSize(f.size)}</span>
                      <IconButton size="2xsmall" variant="transparent" onClick={() => { setFiles(files.filter((_, k) => k !== i)); setDirty(true) }}><XMark /></IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
