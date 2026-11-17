import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteFilesWorkflow, uploadFilesWorkflow } from "@medusajs/core-flows"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { renderDatasheetPdf, type DatasheetData } from "../../../../../modules/catalog/datasheet-pdf"
import { COMPANY_MODULE } from "../../../../../modules/company"
import type CompanyModuleService from "../../../../../modules/company/service"

type Loose = Record<string, any>

/** Texts printed when the product leaves the field empty (the admin form shows them as placeholders). */
export const DATASHEET_DEFAULTS = {
  hygiene: "Limpie las superficies con detergente neutro y un paño suave. Para desinfección de rutina, utilice desinfectantes de uso hospitalario compatibles con acero inoxidable (p. ej., a base de alcohol al 70 %). Evite productos abrasivos o con cloro concentrado.",
  safety: "Utilice el mobiliario sobre superficies planas, firmes y secas. Si tiene ruedas, bloquee al menos dos durante el uso o almacenamiento. No exceda la capacidad de carga recomendada para mantener su estabilidad.",
  maintenance: "Realice inspecciones periódicas del estado de ruedas, frenos, manijas, bisagras y correderas. Verifique que no existan holguras ni daños. Ante desgaste o fallas, gestione el reemplazo de los componentes con el fabricante.",
  warranty: "Garantía de 12 meses por defectos de fabricación en la estructura y herrajes, bajo condiciones de uso clínico normal y mantenimiento adecuado.",
  notes: "Las capacidades de carga y tolerancias se incorporan solo cuando estén verificadas para el modelo.",
  motto: "Fabricamos para quienes cuidan.",
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim())
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""))
const mm = (cm: unknown) => { const n = Number(cm); return Number.isFinite(n) && n > 0 ? fmt(n * 10) : null }
const today = () => { const t = new Date(Date.now() - 5 * 3600000); return `${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${t.getUTCFullYear()}` }

/** Fetches an image and returns PNG/JPEG bytes react-pdf can embed (product photos are WebP). */
async function embeddable(url: string | null | undefined, keepAlpha = false, maxEdge = 1200) {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const img = sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    return keepAlpha ? { data: await img.png().toBuffer(), format: "png" as const } : { data: await img.flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer(), format: "jpg" as const }
  } catch {
    return null
  }
}

/** "600 × 450 × 950 mm", with ranges when the product is adjustable. */
function dimensionsMm(m: Loose, p: Loose): string | null {
  const part = (v: unknown, max: unknown) => { const a = mm(v); if (!a) return null; const b = m.dim_adjustable ? mm(max) : null; return b && Number(b) > Number(a) ? `${a}–${b}` : a }
  const parts = [part(m.dim_length ?? p.length, m.dim_length_max), part(m.dim_depth ?? p.width, m.dim_depth_max), part(m.dim_height ?? p.height, m.dim_height_max)]
  if (parts.every((x) => !x)) return str(m.dimensions) || null
  return `${parts.map((x) => x || "—").join(" × ")} mm (ancho × profundidad × alto)`
}

/**
 * POST /admin/web-products/:id/datasheet — builds the technical datasheet PDF from the product and its
 * metadata.datasheet fields, stores it and links it. Regenerates only when the printed content changed
 * (or `force`). The public link (metadata.datasheet_url) is set only for approved datasheets.
 */
export async function POST(req: AuthenticatedMedusaRequest<{ force?: boolean }>, res: MedusaResponse) {
  const force = !!(req.body as Loose | undefined)?.force
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const products = req.scope.resolve(Modules.PRODUCT) as { updateProducts: (id: string, data: Loose) => Promise<Loose> }
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "subtitle", "description", "handle", "status", "thumbnail", "material", "length", "width", "height", "metadata", "images.url", "categories.name", "categories.parent_category.name", "variants.title", "variants.length", "variants.width", "variants.height", "sales_channels.id"],
    filters: { id: req.params.id },
  })
  const p = (data as Loose[])[0]
  if (!p) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Producto no encontrado")
  const m: Loose = { ...(p.metadata || {}) }
  const ds: Loose = { ...(m.datasheet || {}) }
  const mode = ds.mode === "manual" ? "manual" : "auto"
  if (mode === "manual") { res.json({ product: p, generated: false, mode }); return }

  // Company: KARVEN if the product is on its channel, otherwise FABMETAL when only there
  const companies = await (req.scope.resolve(COMPANY_MODULE) as CompanyModuleService).ensureDefaults()
  const channelIds: string[] = (p.sales_channels || []).map((c: Loose) => c.id)
  const company = companies.find((c) => c.code === "karven" && channelIds.includes(c.sales_channel_id)) || companies.find((c) => channelIds.includes(c.sales_channel_id)) || companies.find((c) => c.code === "karven") || companies[0]
  const prefix = company?.code === "fabmetal" ? "FM-FT-" : "KM-FT-"

  const alts: Loose = m.image_alts || {}
  const photo = p.thumbnail || p.images?.[0]?.url || null
  const category = p.categories?.[0]
  const features = Array.isArray(m.features) ? m.features.map(String).filter(Boolean) : []
  const variantDims = (p.variants || []).filter((v: Loose) => v.length || v.width || v.height)
  const specs: [string, string][] = []
  const dims = dimensionsMm(m, p)
  if (variantDims.length > 1) specs.push(["Dimensiones exteriores", `${variantDims.map((v: Loose) => [mm(v.length), mm(v.width), mm(v.height)].map((x) => x || "—").join(" × ")).join("  ·  ")} mm (ancho × profundidad × alto, según medida)`])
  else if (dims) specs.push(["Dimensiones exteriores", dims])
  if (str(m.dim_note)) specs.push(["Detalle de medidas", str(m.dim_note)])
  const material = str(p.material || m.material)
  if (material) specs.push(["Material principal", material])
  for (const [label, value] of [["Estructura", ds.structure], ["Configuración", ds.configuration], ["Movilidad", ds.mobility || m.wheels], ["Acabado", ds.finish || m.finish], ["Características", ds.characteristics || features.join(" · ")]] as [string, unknown][]) if (str(value)) specs.push([label, str(value)])
  for (const row of Array.isArray(ds.extra_specs) ? ds.extra_specs : []) if (str(row?.label) && str(row?.value)) specs.push([str(row.label), str(row.value)])

  const source = {
    company: company ? [company.name, company.brand_line, company.tagline, company.logo_url, company.color, company.website, company.storefront_url] : null,
    title: p.title, subtitle: p.subtitle, description: p.description, handle: p.handle, status: p.status, photo, alt: photo ? alts[photo] : null,
    category: [category?.name, category?.parent_category?.name], specs,
    // generated fields excluded; mode/version normalised so the first generation does not change the hash
    ds: { ...ds, mode: "auto", version: str(ds.version) || "01", code: undefined, auto_url: undefined, file_id: undefined, hash: undefined, issued_at: undefined, generated_at: undefined },
    uses: m.uses, options: m.options, warranty: m.warranty,
  }
  const hash = createHash("sha1").update(JSON.stringify(source)).digest("hex")
  const approved = ds.approved === true

  if (!force && ds.hash === hash && ds.auto_url) {
    const wantUrl = approved ? ds.auto_url : null
    if ((m.datasheet_url || null) !== wantUrl) {
      const updated = await products.updateProducts(p.id, { metadata: { ...m, datasheet_url: wantUrl, datasheet_name: wantUrl ? `Ficha técnica ${ds.code}.pdf` : null } })
      res.json({ product: updated, generated: false, mode }); return
    }
    res.json({ product: p, generated: false, mode }); return
  }

  // Sequential code per company prefix, assigned once
  let code = str(ds.code)
  if (!code) {
    const { data: all } = await query.graph({ entity: "product", fields: ["id", "metadata"] })
    const max = (all as Loose[]).reduce((acc, x) => { const c = str(x.metadata?.datasheet?.code); return c.startsWith(prefix) ? Math.max(acc, Number(c.slice(prefix.length)) || 0) : acc }, 0)
    code = `${prefix}${String(max + 1).padStart(4, "0")}`
  }
  const version = str(ds.version) || "01"
  const site = str(company?.storefront_url || company?.website || "https://karvenmedical.com").replace(/\/$/, "")

  const [logo, image, front, side, top] = await Promise.all([
    embeddable(company?.logo_url, true, 600),
    embeddable(photo),
    embeddable(ds.drawings?.front, true), embeddable(ds.drawings?.side, true), embeddable(ds.drawings?.top, true),
  ])
  const brandWords = str(company?.brand_line || company?.name || "KARVEN Medical").split(/\s+/)
  const sheet: DatasheetData = {
    brand: brandWords[0] || "KARVEN",
    brandSub: brandWords.slice(1).join(" "),
    tagline: company?.code === "fabmetal" ? str(company?.tagline) : "Mobiliario médico, veterinario y técnico",
    motto: company?.code === "fabmetal" ? "" : DATASHEET_DEFAULTS.motto,
    accent: /^#[0-9a-f]{6}$/i.test(str(company?.color)) ? str(company?.color) : "#0E6B78",
    logo,
    code, version, issued: today(),
    family: str(ds.family) || str(category?.parent_category?.name) || str(category?.name),
    title: str(p.title),
    reference: str(ds.reference) || [str(p.subtitle), str(category?.name)].filter(Boolean).join(" · "),
    published: p.status === "published",
    approved,
    image,
    imageCaption: photo ? str(alts[photo]) || "Fotografía o render identificado" : "",
    intendedUse: str(ds.intended_use) || str(m.uses),
    description: str(ds.description) || str(p.description),
    specs,
    drawings: [{ label: "Vista frontal", image: front }, { label: "Vista lateral", image: side }, { label: "Vista superior", image: top }],
    hygiene: str(ds.hygiene) || DATASHEET_DEFAULTS.hygiene,
    safety: str(ds.safety) || DATASHEET_DEFAULTS.safety,
    maintenance: str(ds.maintenance) || DATASHEET_DEFAULTS.maintenance,
    warranty: str(ds.warranty) || str(m.warranty) || DATASHEET_DEFAULTS.warranty,
    configurations: str(ds.configurations) || str(m.options),
    notes: str(ds.notes) || DATASHEET_DEFAULTS.notes,
    maker: "Fabricado en Panamá por FABMETAL",
    website: site.replace(/^https?:\/\//, ""),
    productUrl: p.status === "published" ? `${site}/mobiliario/${p.handle}` : "",
  }

  const pdf = await renderDatasheetPdf(sheet)
  const filename = `ficha-tecnica-${p.handle}-v${version}.pdf`
  const { result } = await uploadFilesWorkflow(req.scope).run({ input: { files: [{ filename, mimeType: "application/pdf", content: pdf.toString("base64"), access: "public" }] } })
  const file = (result as { id: string; url: string }[])[0]
  if (ds.file_id && ds.file_id !== file.id) { try { await deleteFilesWorkflow(req.scope).run({ input: { ids: [ds.file_id] } }) } catch { /* old file already gone */ } }

  const nextDs = { ...ds, mode: "auto", code, version, hash, auto_url: file.url, file_id: file.id, generated_at: new Date().toISOString() }
  const updated = await products.updateProducts(p.id, {
    metadata: { ...m, datasheet: nextDs, datasheet_url: approved ? file.url : null, datasheet_name: approved ? `Ficha técnica ${code}.pdf` : null },
  })
  res.json({ product: updated, generated: true, mode, url: file.url })
}
