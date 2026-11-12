import { Button, Container, Heading, Input, Label, Select, Text, Textarea } from "@medusajs/ui"
import { LINES, slugify, type ProjectInput } from "../lib/projects"
import MediaGallery from "./media-gallery"
import ProductPicker from "./product-picker"

interface Props {
  value: ProjectInput
  onChange: (next: ProjectInput) => void
  siteUrl: string
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

const Counter = ({ value, max }: { value: string; max: number }) => (
  <span className={`text-xs ${value.length > max ? "text-ui-fg-error" : "text-ui-fg-muted"}`}>{value.length}/{max}</span>
)

/** All editable fields of a project, grouped like the public page: ficha, narrativa, multimedia, SEO. */
export default function ProjectForm({ value, onChange, siteUrl }: Props) {
  const set = <K extends keyof ProjectInput>(key: K, v: ProjectInput[K]) => onChange({ ...value, [key]: v })
  const text = (key: keyof ProjectInput) => ({ value: (value[key] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never) })
  const slug = value.slug || slugify(value.title)

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Datos del proyecto</Heading></div>
        <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Título del proyecto">
              <Input placeholder="Ej. Jaula veterinaria de hospitalización de 5 estaciones" {...text("title")} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Dirección en la web (URL)" hint={`${siteUrl}/proyectos/${slug || "..."}`}>
              <div className="flex gap-2">
                <Input placeholder="se-genera-desde-el-titulo" value={value.slug || ""} onChange={(e) => set("slug", slugify(e.target.value.replace(/\s+/g, "-")) )} />
                <Button variant="secondary" size="base" type="button" onClick={() => set("slug", slugify(value.title))} disabled={!value.title}>Generar del título</Button>
              </div>
            </Field>
          </div>
          <Field label="Línea de mobiliario">
            <Select value={value.line} onValueChange={(v) => set("line", v as ProjectInput["line"])}>
              <Select.Trigger><Select.Value placeholder="Seleccionar" /></Select.Trigger>
              <Select.Content>
                {LINES.map((l) => <Select.Item key={l.value} value={l.value}>{l.label}</Select.Item>)}
              </Select.Content>
            </Select>
          </Field>
          <Field label="Especialidad" hint="Ej. Veterinaria, Quirófano, Laboratorio">
            <Input placeholder="Veterinaria" {...text("specialty")} />
          </Field>
          <Field label="Tipo de trabajo" hint="Ej. Fabricación de módulo, Equipamiento de sala, Adaptación a medida">
            <Input placeholder="Fabricación de módulo" {...text("work_type")} />
          </Field>
          <Field label="Cliente (opcional)" hint="Se muestra en la ficha; déjelo vacío si es confidencial">
            <Input placeholder="Clínica Veterinaria..." {...text("client_name")} />
          </Field>
          <Field label="Ubicación">
            <Input placeholder="Ciudad de Panamá" {...text("location")} />
          </Field>
          <Field label="Año">
            <Input type="number" min={1990} max={2100} placeholder="2026" value={value.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Resumen para la tarjeta" hint="Una o dos frases; aparece bajo el título en el listado">
              <Textarea rows={2} placeholder="Módulo de hospitalización en acero 304 con cinco estaciones independientes." {...text("summary")} />
            </Field>
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Descripción del trabajo</Heading></div>
        <div className="flex flex-col gap-4 px-6 py-4">
          <Field label="Necesidad del cliente" hint="Qué requería la clínica y cuáles eran las condiciones de utilización.">
            <Textarea rows={4} {...text("client_need")} />
          </Field>
          <Field label="Solución desarrollada" hint="Distribución, dimensiones, materiales, sistemas de puertas y componentes relevantes.">
            <Textarea rows={5} {...text("solution")} />
          </Field>
          <Field label="Fabricación y verificación" hint="Detalles constructivos y comprobaciones documentadas del proyecto.">
            <Textarea rows={4} {...text("fabrication")} />
          </Field>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Fotografías y vídeos</Heading></div>
        <div className="px-6 py-4">
          <MediaGallery items={value.gallery} coverUrl={value.cover_url} onChange={(g) => set("gallery", g)} onCover={(u) => set("cover_url", u)} />
          <div className="mt-4">
            <Field label="Texto alternativo de la portada" hint="Describe la foto de portada para buscadores y lectores de pantalla">
              <Input placeholder="Jaula veterinaria de 5 estaciones instalada" {...text("cover_alt")} />
            </Field>
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Mobiliario utilizado</Heading></div>
        <div className="px-6 py-4">
          <ProductPicker ids={value.related_product_ids} onChange={(ids) => set("related_product_ids", ids)} />
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">SEO</Heading></div>
        <div className="flex flex-col gap-4 px-6 py-4">
          <Field label="Título SEO" hint="Si se deja vacío se usa el título del proyecto. Recomendado: hasta 60 caracteres.">
            <div className="flex items-center gap-2">
              <Input placeholder={value.title ? `${value.title} | KARVEN Medical` : ""} {...text("seo_title")} />
              <Counter value={value.seo_title || ""} max={60} />
            </div>
          </Field>
          <Field label="Descripción SEO" hint="Resumen para Google. Recomendado: 120 a 160 caracteres.">
            <div className="flex items-start gap-2">
              <Textarea rows={3} {...text("seo_description")} />
              <Counter value={value.seo_description || ""} max={160} />
            </div>
          </Field>
          <Field label="Orden en el portafolio" hint="Menor número aparece primero; con el mismo número, los más recientes primero">
            <Input type="number" value={value.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} className="w-32" />
          </Field>
        </div>
      </Container>
    </div>
  )
}
