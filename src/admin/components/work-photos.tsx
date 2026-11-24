import { Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Select, Text, toast, usePrompt } from "@medusajs/ui"
import { useRef, useState } from "react"
import { webUpload } from "../lib/web-products"
import { PHOTO_KIND_LABEL, addPhotos, deletePhoto, errorMessage, fmtDateTime, updatePhoto, type Photo, type PhotoKind, type WorkOrder } from "../lib/workshop"

/** Kind suggested by the stage: inspection photos while inspecting, delivery photos once released. */
export const defaultKind = (o: WorkOrder): PhotoKind => (o.stage === "inspection" ? "inspection" : ["released", "delivered", "closed"].includes(o.stage) ? "delivery" : "progress")
const KINDS = Object.keys(PHOTO_KIND_LABEL) as PhotoKind[]
const kindColor = (k: PhotoKind) => (k === "inspection" ? "orange" : k === "delivery" ? "green" : k === "issue" ? "red" : "blue")

/** Upload button: phone camera or gallery, several at once. Photos are rotated, resized (1600 px) and stored as WebP. */
export function PhotoUpload({ order, kind, onChange, label = "Subir fotos", variant = "secondary" }: { order: WorkOrder; kind: PhotoKind; onChange: (o: WorkOrder) => void; label?: string; variant?: "primary" | "secondary" }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
    if (!images.length) { toast.error("Elija fotos (JPG, PNG, HEIC…)"); return }
    if (images.length > 20) { toast.error("Máximo 20 fotos por vez"); return }
    setBusy(true)
    try {
      const uploaded = await webUpload(images)
      const { order: next } = await addPhotos(order.id, uploaded.map((u) => ({ url: u.url, file_id: u.id, kind, width: u.width || null, height: u.height || null })))
      onChange(next)
      toast.success(`${uploaded.length} foto${uploaded.length === 1 ? "" : "s"} de ${PHOTO_KIND_LABEL[kind].toLowerCase()} guardada${uploaded.length === 1 ? "" : "s"}`)
    } catch (e) { toast.error(errorMessage(e, "No se pudieron subir las fotos")) } finally { setBusy(false); if (input.current) input.current.value = "" }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={(e) => upload(Array.from(e.target.files || []))} />
      <Button size="small" variant={variant} isLoading={busy} onClick={() => input.current?.click()}>{label}</Button>
    </>
  )
}

/** Photo evidence of the order: progress, inspection, delivery, issues. */
export default function WorkPhotos({ order, onChange }: { order: WorkOrder; onChange: (o: WorkOrder) => void }) {
  const prompt = usePrompt()
  const photos = order.photos || []
  const [filter, setFilter] = useState<PhotoKind | "all">("all")
  const [kind, setKind] = useState<PhotoKind>(defaultKind(order))
  const [editing, setEditing] = useState<{ id: string; caption: string } | null>(null)
  const shown = filter === "all" ? photos : photos.filter((p) => p.kind === filter)
  const count = (k: PhotoKind) => photos.filter((p) => p.kind === k).length

  const run = async (fn: () => Promise<{ order: WorkOrder }>, ok: string) => { try { onChange((await fn()).order); toast.success(ok) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } }
  const remove = async (p: Photo) => {
    if (!(await prompt({ title: "Eliminar foto", description: "La foto se borra del registro de la orden.", confirmText: "Eliminar", cancelText: "Volver" }))) return
    await run(() => deletePhoto(p.id), "Foto eliminada")
  }
  const saveCaption = async () => { if (editing) { await run(() => updatePhoto(editing.id, { caption: editing.caption.trim() || null }), "Descripción guardada"); setEditing(null) } }

  return (
    <Container className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Heading level="h2">Fotos y evidencias</Heading><Text size="xsmall" className="text-ui-fg-subtle">Avance del trabajo, inspección de calidad, entrega e incidencias. Desde el celular abre la cámara.</Text></div>
        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select size="small" value={kind} onValueChange={(v) => setKind(v as PhotoKind)}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{KINDS.map((k) => <Select.Item key={k} value={k}>{PHOTO_KIND_LABEL[k]}</Select.Item>)}</Select.Content>
            </Select>
          </div>
          <PhotoUpload order={order} kind={kind} onChange={onChange} />
        </div>
      </div>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Button size="small" variant={filter === "all" ? "secondary" : "transparent"} onClick={() => setFilter("all")}>Todas ({photos.length})</Button>
          {KINDS.filter((k) => count(k) > 0).map((k) => <Button key={k} size="small" variant={filter === k ? "secondary" : "transparent"} onClick={() => setFilter(k)}>{PHOTO_KIND_LABEL[k]} ({count(k)})</Button>)}
        </div>
      )}
      {photos.length === 0 ? <Text size="small" className="text-ui-fg-subtle">Sin fotos todavía.</Text> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
              <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption || PHOTO_KIND_LABEL[p.kind]} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" /></a>
              <div className="absolute left-2 top-2"><Badge size="2xsmall" color={kindColor(p.kind)}>{PHOTO_KIND_LABEL[p.kind]}</Badge></div>
              <IconButton size="2xsmall" variant="primary" className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" onClick={() => remove(p)} aria-label="Eliminar foto"><Trash /></IconButton>
              <figcaption className="p-2">
                {editing?.id === p.id ? (
                  <input className="txt-compact-xsmall w-full rounded border border-ui-border-base bg-ui-bg-field px-1.5 py-1" autoFocus value={editing.caption} placeholder="Descripción" onChange={(e) => setEditing({ ...editing, caption: e.target.value })} onBlur={saveCaption} onKeyDown={(e) => { if (e.key === "Enter") saveCaption(); if (e.key === "Escape") setEditing(null) }} />
                ) : (
                  <button type="button" className="txt-compact-xsmall w-full truncate text-left hover:underline" onClick={() => setEditing({ id: p.id, caption: p.caption || "" })}>{p.caption || <span className="text-ui-fg-muted">Añadir descripción</span>}</button>
                )}
                <Text size="xsmall" className="text-ui-fg-muted">{fmtDateTime(p.created_at)}</Text>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Container>
  )
}
