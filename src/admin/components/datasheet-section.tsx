import { Badge, Button, IconButton, Input, Label, Switch, Text, Textarea, Tooltip, toast } from "@medusajs/ui"
import { DocumentText, Photo, Plus, Trash, XMark } from "@medusajs/icons"
import { useRef, useState } from "react"
import { webUpload, type Datasheet } from "../lib/web-products"

/** Values the PDF falls back to when a field is left empty (shown as placeholders). */
export interface DatasheetHints {
  family: string
  reference: string
  uses: string
  description: string
  mobility: string
  finish: string
  characteristics: string
  configurations: string
  warranty: string
}

interface Props {
  value: Datasheet
  onChange: (next: Datasheet) => void
  hints: DatasheetHints
  manualUrl: string | null
  manualName: string | null
  onManual: (url: string | null, name: string | null) => void
  /** Saved product: enables "Regenerar ahora" and the generated PDF link */
  canGenerate: boolean
  generating: boolean
  onRegenerate: () => void
}

const DEFAULTS = {
  hygiene: "Limpie las superficies con detergente neutro y un paño suave. Para desinfección de rutina, utilice desinfectantes de uso hospitalario compatibles con acero inoxidable…",
  safety: "Utilice el mobiliario sobre superficies planas, firmes y secas. Si tiene ruedas, bloquee al menos dos durante el uso…",
  maintenance: "Realice inspecciones periódicas del estado de ruedas, frenos, manijas, bisagras y correderas…",
  warranty: "Garantía de 12 meses por defectos de fabricación en la estructura y herrajes…",
  notes: "Las capacidades de carga y tolerancias se incorporan solo cuando estén verificadas para el modelo.",
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s)
const fromProduct = (v: string) => (v ? `Vacío = del producto: ${short(v)}` : "Vacío = no se imprime")

const VIEWS: { key: "front" | "side" | "top"; label: string }[] = [
  { key: "front", label: "Vista frontal" },
  { key: "side", label: "Vista lateral" },
  { key: "top", label: "Vista superior" },
]

/** Block 05: technical datasheet. Automatic PDF built from the product + these fields, or an uploaded PDF. */
export default function DatasheetSection({ value, onChange, hints, manualUrl, manualName, onManual, canGenerate, generating, onRegenerate }: Props) {
  const set = <K extends keyof Datasheet>(k: K, v: Datasheet[K]) => onChange({ ...value, [k]: v })
  const text = (k: keyof Datasheet) => ({ value: (value[k] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never) })
  const drawInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const [drawTarget, setDrawTarget] = useState<"front" | "side" | "top" | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  const onDrawing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ""
    const target = drawTarget; setDrawTarget(null)
    if (!file || !target) return
    if (!file.type.startsWith("image/")) { toast.error("El plano debe ser una imagen (PNG o JPG)"); return }
    setUploading(target)
    try { const [u] = await webUpload([file], true); onChange({ ...value, drawings: { ...value.drawings, [target]: u.url } }) } catch (err) { toast.error(err instanceof Error ? err.message : "No se pudo subir") } finally { setUploading(null) }
  }
  const onPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf") { toast.error("Debe ser un PDF"); return }
    setUploading("pdf")
    try { const [u] = await webUpload([file]); onManual(u.url, file.name) } catch (err) { toast.error(err instanceof Error ? err.message : "No se pudo subir") } finally { setUploading(null) }
  }

  const rows = value.extra_specs || []
  const setRow = (i: number, patch: Partial<{ label: string; value: string }>) => set("extra_specs", rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-ui-bg-subtle p-1">
        {([["auto", "Generada automáticamente"], ["manual", "PDF propio"]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => set("mode", m)} className={`rounded-md px-3 py-2 text-sm transition-colors ${value.mode === m ? "bg-ui-bg-base font-medium shadow-elevation-card-rest" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>{label}</button>
        ))}
      </div>

      {value.mode === "manual" ? (
        <div className="flex flex-col gap-3">
          <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={onPdf} />
          {manualUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-ui-border-base p-3">
              <DocumentText className="shrink-0 text-ui-fg-muted" />
              <div className="min-w-0 flex-1"><Text size="small" weight="plus" className="truncate">{manualName || "Ficha técnica.pdf"}</Text><a href={manualUrl} target="_blank" rel="noreferrer" className="text-xs text-ui-fg-interactive hover:underline">Abrir PDF</a></div>
              <Button size="small" variant="secondary" type="button" isLoading={uploading === "pdf"} onClick={() => pdfInput.current?.click()}>Reemplazar</Button>
              <Tooltip content="Quitar"><IconButton size="small" variant="transparent" type="button" onClick={() => onManual(null, null)}><XMark /></IconButton></Tooltip>
            </div>
          ) : (
            <Button size="small" variant="secondary" type="button" isLoading={uploading === "pdf"} onClick={() => pdfInput.current?.click()}><DocumentText /> Subir ficha técnica (PDF, máx. 25 MB)</Button>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">Con PDF propio la web muestra exactamente el archivo subido y no se genera nada.</Text>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ui-border-base p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text size="small" weight="plus">{value.code || "Código asignado al guardar"}</Text>
                <Badge size="2xsmall" color={value.approved ? "green" : "orange"}>{value.approved ? "Aprobada · visible en la web" : "No aprobada · solo en el panel"}</Badge>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">{value.generated_at ? `Última generación: ${new Date(value.generated_at).toLocaleString("es-PA")}` : "Se genera al guardar el producto."} Se regenera sola cada vez que cambia algo que sale en el PDF.</Text>
            </div>
            {value.auto_url && <Button size="small" variant="secondary" asChild><a href={value.auto_url} target="_blank" rel="noreferrer">Ver ficha PDF</a></Button>}
            {canGenerate && <Button size="small" variant="secondary" type="button" isLoading={generating} onClick={onRegenerate}>Regenerar ahora</Button>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 md:col-span-2"><Switch size="small" checked={value.approved} onCheckedChange={(v) => set("approved", v)} /><Text size="small">Ficha aprobada (se publica en la web y figura como "APROBADO")</Text></label>
            <Field label="Versión"><Input size="small" placeholder="01" {...text("version")} /></Field>
            <Field label="Familia" hint={fromProduct(hints.family)}><Input size="small" placeholder={hints.family || "Mobiliario clínico"} {...text("family")} /></Field>
            <div className="md:col-span-2"><Field label="Línea de referencia (bajo el título)" hint={fromProduct(hints.reference)}><Input size="small" placeholder={hints.reference || "Modelo de referencia · Mobiliario auxiliar para instituciones de salud"} {...text("reference")} /></Field></div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Uso previsto" hint={fromProduct(hints.uses)}><Textarea rows={3} placeholder={hints.uses} {...text("intended_use")} /></Field>
            <Field label="Descripción general" hint={fromProduct(hints.description)}><Textarea rows={3} placeholder={short(hints.description, 160)} {...text("description")} /></Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">Especificaciones técnicas</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">Dimensiones (pasadas a mm) y material se toman del producto. Complete aquí lo que solo va en la ficha.</Text>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Estructura"><Input size="small" placeholder="Tubo cuadrado de 30 × 30 mm" {...text("structure")} /></Field>
              <Field label="Configuración"><Input size="small" placeholder="1 gaveta superior · 1 gabinete con puerta y entrepaño" {...text("configuration")} /></Field>
              <Field label="Movilidad" hint={fromProduct(hints.mobility)}><Input size="small" placeholder={hints.mobility || "4 ruedas giratorias · 2 con freno"} {...text("mobility")} /></Field>
              <Field label="Acabado" hint={fromProduct(hints.finish)}><Input size="small" placeholder={hints.finish || "Satinado"} {...text("finish")} /></Field>
              <div className="md:col-span-2"><Field label="Características" hint={fromProduct(hints.characteristics)}><Input size="small" placeholder={short(hints.characteristics, 120)} {...text("characteristics")} /></Field></div>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input size="small" placeholder="Campo (ej. Capacidad de carga)" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                <Input size="small" placeholder="Valor (ej. 80 kg distribuidos)" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                <IconButton size="small" variant="transparent" type="button" onClick={() => set("extra_specs", rows.filter((_, k) => k !== i))}><Trash /></IconButton>
              </div>
            ))}
            <div><Button size="small" variant="secondary" type="button" onClick={() => set("extra_specs", [...rows, { label: "", value: "" }])}><Plus /> Agregar fila a la tabla</Button></div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">Plano dimensional (opcional)</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">Dibujos con cotas. Si no se sube ninguno, la sección no aparece.</Text>
            <input ref={drawInput} type="file" accept="image/*" className="hidden" onChange={onDrawing} />
            <div className="grid gap-3 md:grid-cols-3">
              {VIEWS.map((v) => {
                const url = value.drawings?.[v.key] || null
                return (
                  <div key={v.key} className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-2">
                    <Text size="xsmall" weight="plus">{v.label}</Text>
                    <div className="flex h-28 items-center justify-center overflow-hidden rounded bg-white">{url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <Photo className="text-ui-fg-muted" />}</div>
                    <div className="flex gap-1">
                      <Button size="small" variant="secondary" type="button" className="flex-1" isLoading={uploading === v.key} onClick={() => { setDrawTarget(v.key); drawInput.current?.click() }}>{url ? "Cambiar" : "Subir"}</Button>
                      {url && <IconButton size="small" variant="transparent" type="button" onClick={() => onChange({ ...value, drawings: { ...value.drawings, [v.key]: null } })}><XMark /></IconButton>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">Criterios clínicos y operativos</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Higiene y limpieza" hint="Vacío = texto estándar"><Textarea rows={4} placeholder={DEFAULTS.hygiene} {...text("hygiene")} /></Field>
              <Field label="Seguridad de uso" hint="Vacío = texto estándar"><Textarea rows={4} placeholder={DEFAULTS.safety} {...text("safety")} /></Field>
              <Field label="Mantenimiento" hint="Vacío = texto estándar"><Textarea rows={4} placeholder={DEFAULTS.maintenance} {...text("maintenance")} /></Field>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">Información complementaria</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Garantía" hint={hints.warranty ? fromProduct(hints.warranty) : "Vacío = texto estándar"}><Textarea rows={3} placeholder={hints.warranty || DEFAULTS.warranty} {...text("warranty")} /></Field>
              <Field label="Configuraciones" hint={fromProduct(hints.configurations)}><Textarea rows={3} placeholder={hints.configurations || "Disponible en configuraciones alternativas bajo solicitud…"} {...text("configurations")} /></Field>
              <Field label="Notas técnicas" hint="Vacío = texto estándar"><Textarea rows={3} placeholder={DEFAULTS.notes} {...text("notes")} /></Field>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
