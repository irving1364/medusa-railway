import { Badge, Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea } from "@medusajs/ui"
import { ArrowPath, Plus, Trash } from "@medusajs/icons"
import { useMemo } from "react"
import {
  AVAILABILITY, STOREFRONT_URL, dimensionsLine, publishProblems, slugify, suggestAlt, suggestHandle, suggestSeoDescription, suggestSeoTitle, suggestSubtitle,
  type Category, type Material, type VariantRow, type WebProductForm,
} from "../lib/web-products"
import type { Company } from "../lib/companies"
import DatasheetSection from "./datasheet-section"
import FeaturesEditor from "./features-editor"
import ProductMedia from "./product-media"

interface Props {
  value: WebProductForm
  onChange: (next: WebProductForm) => void
  categories: Category[]
  materials: Material[]
  onManageMaterials: () => void
  /** New products and drafts follow the title with their URL; published ones keep it unless edited on purpose. */
  isNew: boolean
  productId?: string
  previousHandles?: string[]
  companies?: Company[]
  generating?: boolean
  onRegenerate?: () => void
}

const SECTIONS = [
  { id: "info", n: "01", title: "Información general", hint: "Identificación y descripción del producto." },
  { id: "specs", n: "02", title: "Especificaciones técnicas", hint: "Dimensiones y características del producto." },
  { id: "media", n: "03", title: "Fotografías y documentación", hint: "Imágenes del producto y ficha técnica descargable." },
  { id: "publish", n: "04", title: "Disponibilidad, SEO y publicación", hint: "Configure cómo aparecerá el producto en la web." },
  { id: "datasheet", n: "05", title: "Ficha técnica", hint: "PDF generado con los datos del producto y estos campos; se actualiza al guardar." },
]

const Field = ({ label, hint, required, right, children }: { label: string; hint?: string; required?: boolean; right?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2">
      <Label size="small" weight="plus">{label}{required && <span className="text-ui-fg-error"> *</span>}</Label>
      {right}
    </div>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

const Auto = ({ custom, onRestore }: { custom: boolean; onRestore: () => void }) => (
  <span className="flex items-center gap-2">
    <Badge size="2xsmall" color={custom ? "orange" : "green"}>{custom ? "Editado" : "Automático · Editable"}</Badge>
    {custom && <Button size="small" variant="transparent" type="button" onClick={onRestore}><ArrowPath /> Restaurar</Button>}
  </span>
)

const Counter = ({ value, max }: { value: string; max: number }) => (
  <span className={`text-xs ${value.length > max ? "text-ui-fg-error" : "text-ui-fg-muted"}`}>{value.length}/{max}</span>
)

const Section = ({ s, children }: { s: (typeof SECTIONS)[number]; children: React.ReactNode }) => (
  <Container id={s.id} className="scroll-mt-20 divide-y p-0">
    <div className="flex items-start justify-between gap-3 px-6 py-4">
      <div>
        <Heading level="h2">{s.title}</Heading>
        <Text size="small" className="text-ui-fg-subtle">{s.hint}</Text>
      </div>
      <Badge size="2xsmall" color="grey">{s.n} / {String(SECTIONS.length).padStart(2, "0")}</Badge>
    </div>
    <div className="px-6 py-5">{children}</div>
  </Container>
)

/** The four-block product form from the specification. Suggestions regenerate until a field is edited by hand. */
export default function WebProductForm({ value, onChange, categories, materials, onManageMaterials, isNew, productId, previousHandles = [], companies = [], generating = false, onRegenerate }: Props) {
  const lines = useMemo(() => categories.filter((c) => !c.parent_category_id), [categories])
  const category = categories.find((c) => c.id === value.categoryId) || null
  const lineId = category?.parent_category_id || (category && !category.parent_category_id ? category.id : null)
  const subcats = useMemo(() => categories.filter((c) => c.parent_category_id === lineId), [categories, lineId])
  const autoHandle = isNew || value.status === "draft"

  /** Applies a patch and regenerates every suggestion the user has not customised. */
  const apply = (patch: Partial<WebProductForm>) => {
    const next = { ...value, ...patch }
    const cat = categories.find((c) => c.id === next.categoryId) || null
    if (!next.subtitleCustom) next.subtitle = suggestSubtitle(next, cat)
    if (!next.seoTitleCustom) next.seoTitle = suggestSeoTitle(next)
    if (!next.seoDescriptionCustom) next.seoDescription = suggestSeoDescription(next)
    if (!next.handleCustom && autoHandle) next.handle = suggestHandle(next)
    onChange(next)
  }
  const text = (key: keyof WebProductForm) => ({ value: (value[key] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => apply({ [key]: e.target.value } as Partial<WebProductForm>) })

  const activeMaterials = materials.filter((m) => m.active || m.name === value.material)
  const problems = publishProblems(value)
  const dims = dimensionsLine(value)
  const seoTitle = value.seoTitle || suggestSeoTitle(value)
  const seoDescription = value.seoDescription || suggestSeoDescription(value)

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-ui-border-base px-3 py-1 text-xs text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base">
            <span className="font-mono">{s.n}</span> {s.title}
          </a>
        ))}
      </nav>

      {/* 01 */}
      <Section s={SECTIONS[0]}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nombre del producto" required hint="Debe identificar el producto con claridad.">
              <Input placeholder="Ej. Jaula Veterinaria de Hospitalización de 5 Estaciones" {...text("title")} />
            </Field>
          </div>
          <Field label="Categoría principal" required>
            <Select value={lineId || ""} onValueChange={(v) => apply({ categoryId: categories.find((c) => c.parent_category_id === v)?.id || v })}>
              <Select.Trigger><Select.Value placeholder="Seleccionar línea" /></Select.Trigger>
              <Select.Content>{lines.map((l) => <Select.Item key={l.id} value={l.id}>{l.name}</Select.Item>)}</Select.Content>
            </Select>
          </Field>
          <Field label="Subcategoría" required hint="Las opciones cambian según la categoría principal.">
            <Select value={category?.parent_category_id ? category.id : ""} onValueChange={(v) => apply({ categoryId: v })} disabled={!lineId}>
              <Select.Trigger><Select.Value placeholder={lineId ? "Seleccionar subcategoría" : "Elija primero la categoría principal"} /></Select.Trigger>
              <Select.Content>{subcats.map((c) => <Select.Item key={c.id} value={c.id}>{c.name}</Select.Item>)}</Select.Content>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Material principal" required right={<Button size="small" variant="transparent" type="button" onClick={onManageMaterials}>Gestionar materiales</Button>}>
              <Select value={value.material || ""} onValueChange={(v) => apply({ material: v })}>
                <Select.Trigger><Select.Value placeholder="Seleccionar material" /></Select.Trigger>
                <Select.Content>
                  {activeMaterials.map((m) => <Select.Item key={m.id} value={m.name}>{m.name}{m.active ? "" : " (inhabilitado)"}</Select.Item>)}
                  {value.material && !activeMaterials.some((m) => m.name === value.material) && <Select.Item value={value.material}>{value.material}</Select.Item>}
                </Select.Content>
              </Select>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Subtítulo del producto" hint="Propuesta basada en la subcategoría y el material." right={<Auto custom={value.subtitleCustom} onRestore={() => apply({ subtitleCustom: false })} />}>
              <Input value={value.subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value, subtitleCustom: e.target.value !== suggestSubtitle(value, category) })} placeholder="Ej. Jaula veterinaria en acero inoxidable AISI 304" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Descripción del producto" required hint="Explique qué es y para qué sirve. Las características detalladas se agregan en la siguiente sección.">
              <Textarea rows={5} placeholder="Módulo de hospitalización veterinaria de cinco estaciones, destinado al alojamiento temporal y la observación de pacientes…" {...text("description")} />
            </Field>
          </div>
        </div>
      </Section>

      {/* 02 */}
      <Section s={SECTIONS[1]}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label size="small" weight="plus">Dimensiones exteriores</Label>
              <Badge size="2xsmall" color="grey">cm</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([["dimLength", "Largo", "dimLengthMax"], ["dimDepth", "Profundidad", "dimDepthMax"], ["dimHeight", "Altura", "dimHeightMax"]] as const).map(([key, label, maxKey]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label size="xsmall" className="text-ui-fg-subtle">{label}</Label>
                  <div className="flex items-center gap-1.5">
                    <Input size="small" type="number" min={0} step="0.1" inputMode="decimal" placeholder="150" {...text(key)} />
                    {value.dimAdjustable && (<><span className="text-ui-fg-muted">–</span><Input size="small" type="number" min={0} step="0.1" inputMode="decimal" placeholder="máx." {...text(maxKey)} /></>)}
                  </div>
                </div>
              ))}
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">Medidas del producto, sin embalaje. Confirmar si la altura incluye las ruedas.</Text>
            <label className="flex items-center gap-2">
              <Switch size="small" checked={value.dimAdjustable} onCheckedChange={(v) => apply({ dimAdjustable: v })} />
              <Text size="small">Este producto tiene dimensiones ajustables (registre el rango mínimo–máximo)</Text>
            </label>
            <Field label="Nota de dimensiones (opcional)" hint="Ej. Bandeja removible 50 × 35 cm · Base 50 × 55 cm">
              <Input size="small" placeholder="Detalle adicional que la web muestra junto a las medidas" {...text("dimNote")} />
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label size="small" weight="plus">Variantes (medidas o modelos)</Label>
              <Badge size="2xsmall" color="grey">{value.variants.length} variante{value.variants.length === 1 ? "" : "s"}</Badge>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">Un producto con una sola variante usa las dimensiones de arriba. Si se ofrece en varias medidas, agregue una fila por medida con su referencia, precio y dimensiones.</Text>
            {value.variants.length > 1 && (
              <Field label="Nombre de la opción" hint="Cómo se llama lo que cambia entre variantes; aparece en la web como selector.">
                <Input size="small" className="max-w-xs" value={value.optionTitle} onChange={(e) => onChange({ ...value, optionTitle: e.target.value })} placeholder="Medida" />
              </Field>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ui-fg-subtle">
                    <th className="py-1 pr-2">Variante</th><th className="py-1 pr-2">Referencia (SKU)</th><th className="py-1 pr-2">Precio B/.</th>
                    {value.variants.length > 1 && (<><th className="py-1 pr-2">Largo</th><th className="py-1 pr-2">Prof.</th><th className="py-1 pr-2">Alto</th></>)}
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {value.variants.map((v, i) => {
                    const setV = (patch: Partial<VariantRow>) => onChange({ ...value, variants: value.variants.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
                    return (
                      <tr key={v.id || `new-${i}`}>
                        <td className="py-1 pr-2"><Input size="small" value={v.title} onChange={(e) => setV({ title: e.target.value })} placeholder={value.variants.length > 1 ? "120 × 60 × 90 cm" : "Estándar"} /></td>
                        <td className="py-1 pr-2"><Input size="small" value={v.sku} onChange={(e) => setV({ sku: e.target.value })} placeholder="KM-VET-…" /></td>
                        <td className="py-1 pr-2"><Input size="small" type="number" min={0} step="0.01" inputMode="decimal" value={v.price} onChange={(e) => setV({ price: e.target.value })} placeholder="0.00" /></td>
                        {value.variants.length > 1 && (["length", "width", "height"] as const).map((k) => (
                          <td key={k} className="py-1 pr-2"><Input size="small" type="number" min={0} step="0.1" value={v[k]} onChange={(e) => setV({ [k]: e.target.value } as Partial<VariantRow>)} /></td>
                        ))}
                        <td className="py-1 text-right">
                          <Button size="small" variant="transparent" type="button" onClick={() => onChange({ ...value, variants: value.variants.filter((_, j) => j !== i) })} disabled={value.variants.length === 1}><Trash /></Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <Button size="small" variant="secondary" type="button" onClick={() => onChange({ ...value, optionTitle: value.variants.length === 1 && value.optionTitle === "Modelo" ? "Medida" : value.optionTitle, variants: [...value.variants, { id: "", title: "", sku: "", price: "", length: "", width: "", height: "" }] })}><Plus /> Agregar variante</Button>
            </div>
            {value.showPrice && value.variants.some((v) => !v.price) && <Text size="xsmall" className="text-ui-fg-subtle">Las variantes sin precio se muestran con "Solicitar cotización".</Text>}
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <div className="flex items-center justify-between gap-2">
              <Label size="small" weight="plus">Características técnicas</Label>
              <Badge size="2xsmall" color="grey">{value.features.length} registrada{value.features.length === 1 ? "" : "s"}</Badge>
            </div>
            <FeaturesEditor value={value.features} onChange={(features) => onChange({ ...value, features })} />
          </div>

          <div className="grid gap-4 border-t border-ui-border-base pt-5 md:grid-cols-2">
            <Field label="Uso recomendado" hint="Se muestra en la web como «Uso recomendado» y en la ficha técnica como «Uso previsto». Vacío = no se muestra.">
              <Textarea rows={3} placeholder="Hospitalización · Observación · Recuperación postoperatoria" value={value.uses} onChange={(e) => onChange({ ...value, uses: e.target.value })} />
            </Field>
            <Field label="Opciones disponibles" hint="Accesorios o variantes bajo pedido. Se muestra en la tabla de especificación como «Opciones». Vacío = no se muestra.">
              <Textarea rows={3} placeholder="Grifería · Ducha manual · Gavetas y gabinete inferior" value={value.options} onChange={(e) => onChange({ ...value, options: e.target.value })} />
            </Field>
          </div>

          <div className="flex flex-col gap-2 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">Vista previa de especificaciones</Label>
            <div className="rounded-lg bg-ui-bg-subtle p-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-ui-border-base pb-2"><span className="text-ui-fg-subtle">Dimensiones</span><span className="font-medium">{dims || "—"}{value.dimNote ? <span className="ml-2 text-ui-fg-subtle">· {value.dimNote}</span> : null}</span></div>
              {value.features.length ? (
                <ul className="mt-2 flex flex-col gap-1">{value.features.map((f, i) => <li key={i} className="flex items-start gap-2"><span className="text-ui-fg-interactive">✓</span>{f}</li>)}</ul>
              ) : <Text size="xsmall" className="mt-2 text-ui-fg-subtle">Sin características.</Text>}
            </div>
          </div>
        </div>
      </Section>

      {/* 03 */}
      <Section s={SECTIONS[2]}>
        <ProductMedia
          images={value.images}
          thumbnail={value.thumbnail}
          datasheetUrl={value.datasheetUrl}
          datasheetName={value.datasheetName}
          suggestAlt={(i) => suggestAlt(value, i)}
          onImages={(images) => onChange({ ...value, images })}
          onThumbnail={(thumbnail) => onChange({ ...value, thumbnail })}
          onDatasheet={(datasheetUrl, datasheetName) => onChange({ ...value, datasheetUrl, datasheetName })}
          showDatasheet={false}
        />
      </Section>

      {/* 04 */}
      <Section s={SECTIONS[3]}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label size="small" weight="plus">Empresa</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">En qué web se muestra el producto. Puede estar en las dos.</Text>
            <div className="flex flex-wrap gap-4">
              {companies.filter((c) => c.sales_channel_id).map((c) => {
                const id = c.sales_channel_id as string
                const on = value.salesChannelIds.includes(id)
                return (
                  <label key={c.code} className="flex items-center gap-2">
                    <Switch size="small" checked={on} onCheckedChange={(v) => apply({ salesChannelIds: v ? [...value.salesChannelIds, id] : value.salesChannelIds.filter((x) => x !== id) })} />
                    <Text size="small">{c.name}</Text>
                  </label>
                )
              })}
              {!companies.length && <Text size="xsmall" className="text-ui-fg-subtle">Cargando empresas…</Text>}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">1. Información comercial</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Disponibilidad del producto" required hint={AVAILABILITY.find((a) => a.value === value.availability)?.hint}>
                <Select value={value.availability} onValueChange={(v) => apply({ availability: v as WebProductForm["availability"] })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>{AVAILABILITY.map((a) => <Select.Item key={a.value} value={a.value}>{a.label}</Select.Item>)}</Select.Content>
                </Select>
              </Field>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 pt-6">
                  <Switch size="small" checked={value.showPrice} onCheckedChange={(v) => onChange({ ...value, showPrice: v })} />
                  <Text size="small">Mostrar precio en la web</Text>
                </label>
                {value.showPrice && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {value.variants.length > 1 ? `Se muestra "Desde" con el menor de los ${value.variants.length} precios de la tabla de variantes (bloque 02).` : value.variants[0]?.price ? `Precio de referencia: B/. ${value.variants[0].price}` : "Indique el precio en la tabla de variantes (bloque 02)."}
                  </Text>
                )}
                <label className="flex items-center gap-2">
                  <Switch size="small" checked={value.featured} onCheckedChange={(v) => onChange({ ...value, featured: v })} />
                  <Text size="small">Destacado en el home</Text>
                </label>
                {value.featured && (
                  <Field label="Orden en el home" hint="Menor número primero.">
                    <Input size="small" type="number" min={0} className="max-w-[8rem]" value={value.homeOrder} onChange={(e) => onChange({ ...value, homeOrder: e.target.value })} placeholder="1" />
                  </Field>
                )}
              </div>
            </div>
            <Field label="Tiempo estimado de fabricación" hint="Se muestra en la web debajo de la medida. Vacío = no se muestra.">
              <Input placeholder="10–15 días hábiles" value={value.leadTime} onChange={(e) => onChange({ ...value, leadTime: e.target.value })} />
            </Field>
            <div className="rounded-md bg-ui-bg-subtle px-3 py-2">
              <Text size="xsmall" className="text-ui-fg-subtle">
                {value.availability === "unavailable"
                  ? "El producto se mostrará como no disponible, sin botón de cotización."
                  : value.showPrice
                    ? "El producto se mostrará con su precio de referencia y la opción de solicitar cotización."
                    : "El producto se mostrará con opción de solicitar cotización, sin precio público."}
              </Text>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <div className="flex items-center justify-between gap-2">
              <Label size="small" weight="plus">2. Configuración SEO</Label>
              {(value.seoTitleCustom || value.seoDescriptionCustom || value.handleCustom) && (
                <Button size="small" variant="transparent" type="button" onClick={() => apply({ seoTitleCustom: false, seoDescriptionCustom: false, handleCustom: false })}><ArrowPath /> Restaurar sugerencias</Button>
              )}
            </div>
            <Field label="Título SEO" right={<span className="flex items-center gap-2"><Counter value={seoTitle} max={60} /><Auto custom={value.seoTitleCustom} onRestore={() => apply({ seoTitleCustom: false })} /></span>}>
              <Input value={value.seoTitle} onChange={(e) => onChange({ ...value, seoTitle: e.target.value, seoTitleCustom: e.target.value !== suggestSeoTitle(value) })} placeholder={suggestSeoTitle(value) || "Se genera desde el nombre"} />
            </Field>
            <Field
              label="URL del producto"
              hint={`${STOREFRONT_URL}/mobiliario/${value.handle || "…"}${!isNew && value.status === "published" ? " · Cambiarla en un producto publicado crea una redirección permanente desde la URL anterior." : ""}`}
              right={autoHandle ? <Auto custom={value.handleCustom} onRestore={() => apply({ handleCustom: false, handle: suggestHandle(value) })} /> : <Badge size="2xsmall" color="blue">URL publicada</Badge>}
            >
              <Input value={value.handle} onChange={(e) => onChange({ ...value, handle: slugify(e.target.value.replace(/\s+/g, "-")), handleCustom: true })} placeholder="se-genera-desde-el-nombre" />
            </Field>
            {previousHandles.length > 0 && <Text size="xsmall" className="text-ui-fg-subtle">URLs anteriores que redirigen a esta: {previousHandles.map((h) => `/mobiliario/${h}`).join(", ")}</Text>}
            <Field label="Meta descripción" right={<span className="flex items-center gap-2"><Counter value={seoDescription} max={160} /><Auto custom={value.seoDescriptionCustom} onRestore={() => apply({ seoDescriptionCustom: false })} /></span>}>
              <Textarea rows={3} value={value.seoDescription} onChange={(e) => onChange({ ...value, seoDescription: e.target.value, seoDescriptionCustom: e.target.value !== suggestSeoDescription(value) })} placeholder={suggestSeoDescription(value) || "Se genera desde el nombre y el material"} />
            </Field>
          </div>

          <div className="flex flex-col gap-2 border-t border-ui-border-base pt-5">
            <Label size="small" weight="plus">3. Vista previa</Label>
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text size="xsmall" className="text-ui-fg-muted">Resultado ilustrativo en buscadores</Text>
              <p className="mt-1 text-[17px] leading-snug text-[#1a0dab]">{seoTitle || "Título del producto | KARVEN Medical"}</p>
              <p className="text-xs text-[#006621]">karvenmedical.com/mobiliario/{value.handle || "url-del-producto"}</p>
              <p className="mt-1 text-sm text-ui-fg-subtle">{seoDescription || "Meta descripción del producto."}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-ui-fg-subtle">Estado comercial</span><span className="text-right"><Badge size="2xsmall" color="grey">{AVAILABILITY.find((a) => a.value === value.availability)?.label}</Badge></span>
              <span className="text-ui-fg-subtle">Botón público</span><span className="text-right">{value.availability === "unavailable" ? "Sin botón" : "Solicitar cotización"}</span>
              {productId && value.status === "published" && (<><span className="text-ui-fg-subtle">Página pública</span><a className="text-right text-ui-fg-interactive hover:underline" href={`${STOREFRONT_URL}/mobiliario/${value.handle}`} target="_blank" rel="noreferrer">Ver en la web</a></>)}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ui-border-base pt-5">
            <div className="flex items-center justify-between gap-2">
              <Label size="small" weight="plus">4. Publicación</Label>
              <Badge size="2xsmall" color={value.status === "published" ? "green" : "orange"}>{value.status === "published" ? "Publicado" : "Borrador"}</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border p-3 ${value.status === "draft" ? "border-ui-border-interactive" : "border-ui-border-base"}`}>
                <input type="radio" name="status" className="mt-1" checked={value.status === "draft"} onChange={() => apply({ status: "draft" })} />
                <span><Text size="small" weight="plus">Guardar como borrador</Text><Text size="xsmall" className="text-ui-fg-subtle">No se muestra en la web.</Text></span>
              </label>
              <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border p-3 ${value.status === "published" ? "border-ui-border-interactive" : "border-ui-border-base"}`}>
                <input type="radio" name="status" className="mt-1" checked={value.status === "published"} onChange={() => apply({ status: "published" })} />
                <span><Text size="small" weight="plus">Publicar en la web</Text><Text size="xsmall" className="text-ui-fg-subtle">Visible en karvenmedical.com un minuto después de guardar.</Text></span>
              </label>
            </div>
            {problems.length > 0 ? (
              <Text size="xsmall" className="text-ui-fg-error">Para publicar faltan: {problems.join(", ")}.</Text>
            ) : (
              <Text size="xsmall" className="text-ui-fg-subtle">Los campos esenciales están completos. La ficha PDF puede agregarse después.</Text>
            )}
          </div>
        </div>
      </Section>

      {/* 05 */}
      <Section s={SECTIONS[4]}>
        <DatasheetSection
          value={value.datasheet}
          onChange={(datasheet) => onChange({ ...value, datasheet })}
          hints={{
            family: (categories.find((c) => c.id === lineId)?.name || ""),
            reference: [value.subtitle, category?.name].filter(Boolean).join(" · "),
            uses: value.uses,
            description: value.description,
            mobility: String(value.extraMeta.wheels || ""),
            finish: String(value.extraMeta.finish || ""),
            characteristics: value.features.join(" · "),
            configurations: value.options,
            warranty: String(value.extraMeta.warranty || ""),
          }}
          manualUrl={value.datasheetUrl}
          manualName={value.datasheetName}
          onManual={(datasheetUrl, datasheetName) => onChange({ ...value, datasheetUrl, datasheetName })}
          canGenerate={!!productId}
          generating={generating}
          onRegenerate={() => onRegenerate?.()}
        />
      </Section>
    </div>
  )
}
