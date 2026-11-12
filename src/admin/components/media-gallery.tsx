import { Button, IconButton, Input, Label, Text, Tooltip, toast } from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Photo, Trash, XMark } from "@medusajs/icons"
import { useRef, useState } from "react"
import { uploadFiles, type GalleryItem } from "../lib/projects"

const MAX_IMAGE_MB = 12
const MAX_VIDEO_MB = 60

interface Props {
  items: GalleryItem[]
  coverUrl: string | null
  onChange: (items: GalleryItem[]) => void
  onCover: (url: string | null) => void
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
const isEmbeddable = (url: string) => /youtube\.com|youtu\.be|vimeo\.com|instagram\.com/i.test(url)

/** Photos and videos of a project: upload, reorder, caption, choose the cover, add YouTube/Vimeo/Instagram links. */
export default function MediaGallery({ items, coverUrl, onChange, onCover }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState("")

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ""
    if (!files.length) return
    for (const f of files) {
      const video = f.type.startsWith("video/")
      const max = video ? MAX_VIDEO_MB : MAX_IMAGE_MB
      if (!video && !f.type.startsWith("image/")) { toast.error(`${f.name}: solo imágenes o vídeos MP4`); return }
      if (f.size > max * 1024 * 1024) { toast.error(`${f.name} supera ${max} MB`); return }
    }
    setBusy(true)
    try {
      const uploaded = await uploadFiles(files)
      const added: GalleryItem[] = uploaded.map((u, i) => ({ type: files[i].type.startsWith("video/") ? "video" : "image", url: u.url, alt: "" }))
      const next = [...items, ...added]
      onChange(next)
      if (!coverUrl) { const first = next.find((g) => g.type === "image"); if (first) onCover(first.url) }
      toast.success(`${added.length} archivo${added.length === 1 ? "" : "s"} cargado${added.length === 1 ? "" : "s"}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el archivo")
    } finally {
      setBusy(false)
    }
  }

  const addLink = () => {
    const url = link.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) { toast.error("Pegue un enlace completo que empiece por https://"); return }
    const type: GalleryItem["type"] = isVideoUrl(url) ? "video" : isEmbeddable(url) ? "embed" : "image"
    onChange([...items, { type, url, alt: "" }])
    setLink("")
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const remove = (i: number) => {
    const next = items.filter((_, k) => k !== i)
    onChange(next)
    if (items[i].url === coverUrl) onCover(next.find((g) => g.type === "image")?.url || null)
  }
  const setAlt = (i: number, alt: string) => onChange(items.map((g, k) => (k === i ? { ...g, alt } : g)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" multiple accept="image/*,video/mp4,video/webm" className="hidden" onChange={onPick} />
        <Button size="small" variant="secondary" isLoading={busy} onClick={() => inputRef.current?.click()}>
          <Photo /> Subir fotos o vídeos
        </Button>
        <Text size="xsmall" className="text-ui-fg-subtle">Fotos hasta {MAX_IMAGE_MB} MB · vídeos MP4 hasta {MAX_VIDEO_MB} MB. Para vídeos largos pegue un enlace.</Text>
      </div>
      <div className="flex gap-2">
        <Input size="small" placeholder="Enlace de YouTube, Vimeo, Instagram o imagen (https://...)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink() } }} />
        <Button size="small" variant="secondary" onClick={addLink} disabled={!link.trim()}>Añadir enlace</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ui-border-base p-8 text-center">
          <Photo className="mx-auto text-ui-fg-muted" />
          <Text size="small" className="mt-2 text-ui-fg-subtle">Sin fotografías ni vídeos todavía. La primera foto se usará como portada.</Text>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((g, i) => {
            const isCover = g.url === coverUrl
            return (
              <li key={`${g.url}-${i}`} className={`rounded-lg border p-2 ${isCover ? "border-ui-border-interactive" : "border-ui-border-base"}`}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-ui-bg-subtle">
                  {g.type === "image" ? (
                    <img src={g.url} alt={g.alt || ""} className="h-full w-full object-cover" />
                  ) : g.type === "video" ? (
                    <video src={g.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
                      <Text size="small" weight="plus">Vídeo enlazado</Text>
                      <Text size="xsmall" className="break-all text-ui-fg-subtle">{g.url}</Text>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-ui-bg-base/90 px-1.5 py-0.5 text-[11px] font-medium">
                    {i + 1} · {g.type === "image" ? "Foto" : g.type === "video" ? "Vídeo" : "Enlace"}{isCover ? " · Portada" : ""}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <Tooltip content="Subir"><IconButton size="small" variant="transparent" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUpMini /></IconButton></Tooltip>
                  <Tooltip content="Bajar"><IconButton size="small" variant="transparent" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDownMini /></IconButton></Tooltip>
                  {g.type === "image" && !isCover && (
                    <Button size="small" variant="transparent" onClick={() => onCover(g.url)}>Usar como portada</Button>
                  )}
                  <span className="flex-1" />
                  <Tooltip content="Quitar"><IconButton size="small" variant="transparent" onClick={() => remove(i)}><Trash /></IconButton></Tooltip>
                </div>
                <div className="mt-1">
                  <Label size="xsmall" className="text-ui-fg-subtle">Descripción (texto alternativo)</Label>
                  <Input size="small" value={g.alt || ""} onChange={(e) => setAlt(i, e.target.value)} placeholder="Ej. Jaula de 5 estaciones instalada en hospitalización" />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {coverUrl && !items.some((g) => g.url === coverUrl) && (
        <div className="flex items-center gap-2 rounded-md bg-ui-bg-subtle p-2">
          <img src={coverUrl} alt="" className="h-10 w-14 rounded object-cover" />
          <Text size="xsmall" className="flex-1">Portada externa a la galería</Text>
          <IconButton size="small" variant="transparent" onClick={() => onCover(null)}><XMark /></IconButton>
        </div>
      )}
    </div>
  )
}
