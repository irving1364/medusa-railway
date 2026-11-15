import { Badge, Button, IconButton, Input, Label, Text, Tooltip, toast } from "@medusajs/ui"
import { ArrowDownMini, ArrowPath, ArrowUpMini, DocumentText, Photo, Trash, XMark } from "@medusajs/icons"
import { useRef, useState } from "react"
import { webUpload, type ImageItem } from "../lib/web-products"

const MAX_IMAGE_MB = 10
const MAX_PDF_MB = 25

interface Props {
  images: ImageItem[]
  thumbnail: string | null
  datasheetUrl: string | null
  datasheetName: string | null
  /** Suggested ALT for a new image at `index` (first = product, rest = details). */
  suggestAlt: (index: number) => string
  onImages: (next: ImageItem[]) => void
  onThumbnail: (url: string | null) => void
  onDatasheet: (url: string | null, name: string | null) => void
}

const fmtMb = (bytes?: number) => (bytes ? `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB` : "")

/** Block 03: photo gallery (optimised to WebP on upload, cover, order, ALT, replace, remove) and the technical datasheet PDF. */
export default function ProductMedia({ images, thumbnail, datasheetUrl, datasheetName, suggestAlt, onImages, onThumbnail, onDatasheet }: Props) {
  const picker = useRef<HTMLInputElement>(null)
  const replacer = useRef<HTMLInputElement>(null)
  const pdfPicker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)

  const checkImages = (files: File[]) => {
    for (const f of files) {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name}: solo se admiten imágenes (JPG, PNG, WebP)`); return false }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) { toast.error(`${f.name} supera ${MAX_IMAGE_MB} MB`); return false }
    }
    return true
  }

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ""
    if (!files.length || !checkImages(files)) return
    setBusy(true)
    try {
      const uploaded = await webUpload(files)
      const added: ImageItem[] = uploaded.map((u, i) => ({ url: u.url, alt: suggestAlt(images.length + i), width: u.width, height: u.height }))
      const next = [...images, ...added]
      onImages(next)
      if (!thumbnail) onThumbnail(next[0].url)
      const saved = uploaded.reduce((s, u) => s + ((u as { original_size?: number }).original_size || 0) - (u.size || 0), 0)
      toast.success(`${added.length} foto${added.length === 1 ? "" : "s"} optimizada${added.length === 1 ? "" : "s"}${saved > 0 ? ` · ${fmtMb(saved)} menos` : ""}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la fotografía")
    } finally {
      setBusy(false)
    }
  }

  const onReplace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    const i = replaceIndex
    setReplaceIndex(null)
    if (!file || i === null || !checkImages([file])) return
    setBusy(true)
    try {
      const [u] = await webUpload([file])
      const old = images[i]
      onImages(images.map((img, k) => (k === i ? { ...img, url: u.url, width: u.width, height: u.height } : img)))
      if (thumbnail === old.url) onThumbnail(u.url)
      toast.success("Fotografía reemplazada")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reemplazar")
    } finally {
      setBusy(false)
    }
  }

  const onPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf") { toast.error("La ficha técnica debe ser un PDF"); return }
    if (file.size > MAX_PDF_MB * 1024 * 1024) { toast.error(`El PDF supera ${MAX_PDF_MB} MB`); return }
    setPdfBusy(true)
    try {
      const [u] = await webUpload([file])
      onDatasheet(u.url, file.name)
      toast.success("Ficha técnica cargada")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el PDF")
    } finally {
      setPdfBusy(false)
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onImages(next)
  }
  const remove = (i: number) => {
    const next = images.filter((_, k) => k !== i)
    onImages(next)
    if (images[i].url === thumbnail) onThumbnail(next[0]?.url || null)
  }
  const setAlt = (i: number, alt: string) => onImages(images.map((img, k) => (k === i ? { ...img, alt } : img)))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label size="small" weight="plus">1. Galería de fotografías</Label>
          <Badge size="2xsmall" color="grey">JPG · PNG · WebP</Badge>
        </div>
        <input ref={picker} type="file" multiple accept="image/*" className="hidden" onChange={onPick} />
        <input ref={replacer} type="file" accept="image/*" className="hidden" onChange={onReplace} />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={busy}
          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-ui-border-base px-6 py-7 text-center transition-colors hover:bg-ui-bg-subtle disabled:opacity-60"
        >
          <Photo className="text-ui-fg-muted" />
          <Text size="small" weight="plus">{busy ? "Optimizando…" : "Subir fotografías"}</Text>
          <Text size="xsmall" className="text-ui-fg-subtle">Seleccione una o varias imágenes de hasta {MAX_IMAGE_MB} MB.</Text>
          <Badge size="2xsmall" color="green">Optimización automática a WebP · máx. 1600 px</Badge>
        </button>

        {images.length > 0 && (
          <ul className="flex flex-col gap-2">
            {images.map((img, i) => {
              const isCover = img.url === thumbnail
              return (
                <li key={`${img.url}-${i}`} className={`rounded-lg border p-3 ${isCover ? "border-ui-border-interactive" : "border-ui-border-base"}`}>
                  <div className="flex gap-3">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-white">
                      <img src={img.url} alt="" className="h-full w-full object-contain" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Text size="small" weight="plus">Imagen {i + 1}</Text>
                        {isCover ? <Badge size="2xsmall" color="green">Portada</Badge> : <Button size="small" variant="transparent" type="button" onClick={() => onThumbnail(img.url)}>Establecer portada</Button>}
                        {img.width && img.height && <Text size="xsmall" className="text-ui-fg-muted">{img.width} × {img.height} px</Text>}
                        <span className="flex-1" />
                        <Tooltip content="Subir"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUpMini /></IconButton></Tooltip>
                        <Tooltip content="Bajar"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}><ArrowDownMini /></IconButton></Tooltip>
                        <Tooltip content="Reemplazar archivo"><IconButton size="small" variant="transparent" type="button" onClick={() => { setReplaceIndex(i); replacer.current?.click() }}><ArrowPath /></IconButton></Tooltip>
                        <Tooltip content="Eliminar"><IconButton size="small" variant="transparent" type="button" onClick={() => remove(i)}><Trash /></IconButton></Tooltip>
                      </div>
                      <Label size="xsmall" className="text-ui-fg-subtle">Texto alternativo (ALT) — SEO</Label>
                      <Input size="small" value={img.alt} onChange={(e) => setAlt(i, e.target.value)} placeholder={suggestAlt(i) || "Describa lo que muestra la foto"} />
                      <div className="flex items-center justify-between gap-2">
                        <Text size="xsmall" className="text-ui-fg-subtle">Sugerido automáticamente; confirme que describe lo que muestra la foto.</Text>
                        {img.alt !== suggestAlt(i) && suggestAlt(i) && <Button size="small" variant="transparent" type="button" onClick={() => setAlt(i, suggestAlt(i))}>Usar sugerencia</Button>}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label size="small" weight="plus">2. Ficha técnica PDF</Label>
          <Badge size="2xsmall" color="grey">Siempre visible</Badge>
        </div>
        <input ref={pdfPicker} type="file" accept="application/pdf" className="hidden" onChange={onPdf} />
        {datasheetUrl ? (
          <div className="flex items-center gap-3 rounded-lg border border-ui-border-base p-3">
            <DocumentText className="shrink-0 text-ui-fg-muted" />
            <div className="min-w-0 flex-1">
              <Text size="small" weight="plus" className="truncate">{datasheetName || "Ficha técnica.pdf"}</Text>
              <a href={datasheetUrl} target="_blank" rel="noreferrer" className="text-xs text-ui-fg-interactive hover:underline">Abrir PDF</a>
            </div>
            <Button size="small" variant="secondary" type="button" isLoading={pdfBusy} onClick={() => pdfPicker.current?.click()}>Reemplazar</Button>
            <Tooltip content="Quitar"><IconButton size="small" variant="transparent" type="button" onClick={() => onDatasheet(null, null)}><XMark /></IconButton></Tooltip>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => pdfPicker.current?.click()}
            disabled={pdfBusy}
            className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-ui-border-base px-6 py-6 text-center transition-colors hover:bg-ui-bg-subtle disabled:opacity-60"
          >
            <DocumentText className="text-ui-fg-muted" />
            <Text size="small" weight="plus">{pdfBusy ? "Subiendo…" : "Subir ficha técnica"}</Text>
            <Text size="xsmall" className="text-ui-fg-subtle">Archivo PDF · máximo {MAX_PDF_MB} MB. Puede agregarse después de publicar.</Text>
          </button>
        )}
        {!datasheetUrl && <Text size="xsmall" className="text-ui-fg-subtle">Todavía no se ha cargado una ficha técnica. La web mostrará el botón de descarga cuando exista.</Text>}
      </div>
    </div>
  )
}
