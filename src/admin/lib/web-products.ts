import type { HttpTypes } from "@medusajs/framework/types"
import { sdk } from "./sdk"

/* ─── Domain ───────────────────────────────────────────────────────────────── */

export type Availability = "available" | "on_order" | "custom" | "unavailable"

export const AVAILABILITY: { value: Availability; label: string; hint: string }[] = [
  { value: "available", label: "Disponible", hint: "Hay unidades listas para entrega." },
  { value: "on_order", label: "Bajo pedido", hint: "Se fabrica al confirmar el pedido. Es la modalidad habitual de KARVEN." },
  { value: "custom", label: "Fabricación a medida", hint: "Se desarrolla según los requisitos del cliente; se cotiza caso por caso." },
  { value: "unavailable", label: "No disponible", hint: "Se muestra en la web sin opción de cotizar." },
]
export const availabilityLabel = (v: string | null | undefined) => AVAILABILITY.find((a) => a.value === v)?.label || "Bajo pedido"

export interface Material { id: string; name: string; active: boolean; sort_order: number }

export interface Category { id: string; name: string; handle: string; parent_category_id: string | null }

/** One purchasable variant (size/model). `id` is empty for variants added in the form and not saved yet. */
export interface VariantRow { id: string; title: string; sku: string; price: string; length: string; width: string; height: string }

export const FEATURED_COLLECTION_HANDLE = "destacados"

/** Technical datasheet settings (metadata.datasheet). code/auto_url/file_id/hash/generated_at are written by the backend. */
export interface Datasheet {
  mode: "auto" | "manual"
  approved: boolean
  version: string
  family: string
  reference: string
  intended_use: string
  description: string
  structure: string
  configuration: string
  mobility: string
  finish: string
  characteristics: string
  extra_specs: { label: string; value: string }[]
  drawings: { front: string | null; side: string | null; top: string | null }
  hygiene: string
  safety: string
  maintenance: string
  warranty: string
  configurations: string
  notes: string
  code?: string
  auto_url?: string
  file_id?: string
  hash?: string
  generated_at?: string
}

export const emptyDatasheet = (): Datasheet => ({ mode: "auto", approved: false, version: "01", family: "", reference: "", intended_use: "", description: "", structure: "", configuration: "", mobility: "", finish: "", characteristics: "", extra_specs: [], drawings: { front: null, side: null, top: null }, hygiene: "", safety: "", maintenance: "", warranty: "", configurations: "", notes: "" })

export interface ImageItem { url: string; alt: string; width?: number | null; height?: number | null }

/** Everything the four-block form edits. Unknown metadata keys from older products are kept in `extraMeta`. */
export interface WebProductForm {
  // 01 Información general
  title: string
  categoryId: string | null
  subtitle: string
  subtitleCustom: boolean
  material: string
  description: string
  // 02 Especificaciones técnicas
  dimLength: string
  dimDepth: string
  dimHeight: string
  dimAdjustable: boolean
  dimLengthMax: string
  dimDepthMax: string
  dimHeightMax: string
  dimNote: string
  features: string[]
  /** Option title used for the variants ("Medida", "Modelo"...) */
  optionTitle: string
  variants: VariantRow[]
  // 03 Fotografías y documentación
  images: ImageItem[]
  thumbnail: string | null
  datasheetUrl: string | null
  datasheetName: string | null
  datasheet: Datasheet
  // 04 Disponibilidad y publicación
  availability: Availability
  showPrice: boolean
  /** Shown on the home rail (collection "destacados") */
  featured: boolean
  homeOrder: string
  /** Shown under the size selector on the web, e.g. "10–15 días hábiles" */
  leadTime: string
  /** "Uso recomendado" block on the product page */
  uses: string
  /** "Opciones" row of the specification table */
  options: string
  /** Sales channels = companies whose web shows the product */
  salesChannelIds: string[]
  seoTitle: string
  seoTitleCustom: boolean
  handle: string
  handleCustom: boolean
  seoDescription: string
  seoDescriptionCustom: boolean
  status: "draft" | "published"
  extraMeta: Record<string, unknown>
}

export const emptyForm = (): WebProductForm => ({
  title: "", categoryId: null, subtitle: "", subtitleCustom: false, material: "", description: "",
  dimLength: "", dimDepth: "", dimHeight: "", dimAdjustable: false, dimLengthMax: "", dimDepthMax: "", dimHeightMax: "", dimNote: "", features: [], optionTitle: "Modelo", variants: [{ id: "", title: "Estándar", sku: "", price: "", length: "", width: "", height: "" }],
  images: [], thumbnail: null, datasheetUrl: null, datasheetName: null, datasheet: emptyDatasheet(),
  availability: "on_order", showPrice: false, featured: false, homeOrder: "", leadTime: "", uses: "", options: "", salesChannelIds: [], seoTitle: "", seoTitleCustom: false, handle: "", handleCustom: false,
  seoDescription: "", seoDescriptionCustom: false, status: "draft", extraMeta: {},
})

/* ─── Suggestions (automatic, editable) ────────────────────────────────────── */

export const slugify = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100)

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Short name of the product type taken from the subcategory ("Jaulas veterinarias" → "Módulo de hospitalización" is not inferable, so we use the category singular form). */
const typeFromCategory = (category: Category | null) => {
  if (!category) return ""
  const n = category.name.trim()
  // "Jaulas veterinarias" → "Jaula veterinaria", "Mesas veterinarias" → "Mesa veterinaria"
  return n.split(" ").map((w, i) => (i === 0 && /s$/i.test(w) && w.length > 3 ? w.replace(/es$/i, "").replace(/s$/i, "") : i > 0 && /as$/i.test(w) ? w.replace(/s$/i, "") : w)).join(" ")
}

/** Rule agreed with the client: category + material, e.g. "Jaula veterinaria en acero inoxidable AISI 304". */
export const suggestSubtitle = (f: Pick<WebProductForm, "material">, category: Category | null) => {
  const type = typeFromCategory(category)
  if (!type && !f.material) return ""
  if (!f.material) return type
  if (!type) return `Fabricado en ${lower(f.material)}`
  return `${type} en ${lower(f.material)}`
}

/** "<nombre> en Panamá | KARVEN Medical", dropping "en Panamá" when the title is long (target ≤ 60 characters). */
export const suggestSeoTitle = (f: Pick<WebProductForm, "title">) => {
  const t = f.title.trim()
  if (!t) return ""
  const full = `${t} en Panamá | KARVEN Medical`
  return full.length <= 60 ? full : `${t} | KARVEN Medical`
}

export const suggestSeoDescription = (f: Pick<WebProductForm, "title" | "material" | "availability" | "description">) => {
  const title = f.title.trim()
  if (!title) return ""
  const mat = f.material ? ` en ${lower(f.material)}` : ""
  const tail = f.availability === "custom" ? "Fabricación a medida en Panamá. Solicite una propuesta a KARVEN Medical." : "Fabricado en Panamá. Solicite cotización a KARVEN Medical."
  return `${title}${mat}, ${tail}`.slice(0, 160)
}

export const suggestHandle = (f: Pick<WebProductForm, "title">) => slugify(f.title)

/** First image describes the product; the rest are details. */
export const suggestAlt = (f: Pick<WebProductForm, "title" | "material">, index: number) => {
  const title = f.title.trim()
  if (!title) return ""
  const mat = f.material ? ` en ${lower(f.material)}` : ""
  return index === 0 ? `${title}${mat}` : `Detalle ${index} de ${lower(title)}`
}

/* ─── Dimensions ───────────────────────────────────────────────────────────── */

const num = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null }
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""))

/** "150 × 70 × 165 cm", with ranges when adjustable ("50 × 55 × 85–130 cm"). */
export const dimensionsLine = (f: Pick<WebProductForm, "dimLength" | "dimDepth" | "dimHeight" | "dimAdjustable" | "dimLengthMax" | "dimDepthMax" | "dimHeightMax">) => {
  const part = (v: string, max: string) => { const a = num(v); if (a === null) return null; const b = f.dimAdjustable ? num(max) : null; return b && b > a ? `${fmt(a)}–${fmt(b)}` : fmt(a) }
  const parts = [part(f.dimLength, f.dimLengthMax), part(f.dimDepth, f.dimDepthMax), part(f.dimHeight, f.dimHeightMax)]
  if (parts.every((p) => p === null)) return ""
  return `${parts.map((p) => p ?? "—").join(" × ")} cm`
}

/* ─── Product ⇄ form ───────────────────────────────────────────────────────── */

export type AdminProduct = HttpTypes.AdminProduct

const FORM_META_KEYS = ["material", "dim_length", "dim_depth", "dim_height", "dim_adjustable", "dim_length_max", "dim_depth_max", "dim_height_max", "dim_note", "features", "availability", "show_price", "seo_title", "seo_title_custom", "seo_description", "seo_description_custom", "handle_custom", "subtitle_custom", "image_alts", "datasheet_url", "datasheet_name", "datasheet", "dimensions", "home_order", "lead_time", "uses", "options"]

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))
const numStr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? fmt(v) : typeof v === "string" && num(v) !== null ? v : "")

export const toForm = (p: AdminProduct): WebProductForm => {
  const m = (p.metadata || {}) as Record<string, unknown>
  const alts = (m.image_alts && typeof m.image_alts === "object" ? (m.image_alts as Record<string, string>) : {}) || {}
  const extraMeta = Object.fromEntries(Object.entries(m).filter(([k]) => !FORM_META_KEYS.includes(k)))
  const variants: VariantRow[] = (p.variants || []).map((v) => {
    const price = (v.prices || []).find((pr) => pr.currency_code === "pab")?.amount ?? (v.prices || [])[0]?.amount ?? null
    return { id: v.id, title: v.title || "", sku: v.sku || "", price: price != null ? fmt(price) : "", length: numStr(v.length), width: numStr(v.width), height: numStr(v.height) }
  })
  const optionTitle = p.options?.[0]?.title && !/^default/i.test(p.options[0].title) ? p.options[0].title : "Modelo"
  return {
    title: p.title || "",
    categoryId: p.categories?.[0]?.id || null,
    subtitle: p.subtitle || "",
    subtitleCustom: m.subtitle_custom === true,
    material: str(p.material || m.material),
    description: p.description || "",
    dimLength: numStr(m.dim_length ?? p.length), dimDepth: numStr(m.dim_depth ?? p.width), dimHeight: numStr(m.dim_height ?? p.height),
    dimAdjustable: m.dim_adjustable === true,
    dimLengthMax: numStr(m.dim_length_max), dimDepthMax: numStr(m.dim_depth_max), dimHeightMax: numStr(m.dim_height_max),
    dimNote: str(m.dim_note),
    features: Array.isArray(m.features) ? (m.features as unknown[]).map(String).filter(Boolean) : typeof m.features === "string" ? m.features.split(/[\n;]/).map((s) => s.trim()).filter(Boolean) : [],
    optionTitle,
    variants: variants.length ? variants : [{ id: "", title: "Estándar", sku: "", price: "", length: "", width: "", height: "" }],
    images: (p.images || []).map((i) => ({ url: i.url, alt: alts[i.url] || "" })),
    thumbnail: p.thumbnail || p.images?.[0]?.url || null,
    datasheetUrl: str(m.datasheet_url) || null,
    datasheetName: str(m.datasheet_name) || null,
    // Products with an uploaded PDF and no datasheet settings keep working as "PDF propio"
    datasheet: { ...emptyDatasheet(), ...(m.datasheet && typeof m.datasheet === "object" ? (m.datasheet as Partial<Datasheet>) : m.datasheet_url ? { mode: "manual" as const } : {}), drawings: { front: null, side: null, top: null, ...((m.datasheet as Partial<Datasheet> | undefined)?.drawings || {}) } },
    availability: (["available", "on_order", "custom", "unavailable"].includes(str(m.availability)) ? (m.availability as Availability) : "on_order"),
    showPrice: m.show_price === true,
    featured: p.collection?.handle === FEATURED_COLLECTION_HANDLE,
    salesChannelIds: (p.sales_channels || []).map((c) => c.id),
    homeOrder: numStr(m.home_order),
    leadTime: str(m.lead_time),
    uses: str(m.uses),
    options: str(m.options),
    seoTitle: str(m.seo_title), seoTitleCustom: m.seo_title_custom === true,
    handle: p.handle || "", handleCustom: m.handle_custom === true,
    seoDescription: str(m.seo_description), seoDescriptionCustom: m.seo_description_custom === true,
    status: p.status === "published" ? "published" : "draft",
    extraMeta,
  }
}

/** Builds the Medusa create/update payload. Native fields where Medusa has them; the rest in metadata. */
export const toPayload = (f: WebProductForm, category: Category | null, salesChannelId: string | null, existing: AdminProduct | null, featuredCollectionId: string | null) => {
  const L = num(f.dimLength), D = num(f.dimDepth), H = num(f.dimHeight)
  const image_alts = Object.fromEntries(f.images.filter((i) => i.alt.trim()).map((i) => [i.url, i.alt.trim()]))
  const metadata: Record<string, unknown> = {
    ...f.extraMeta,
    material: f.material || null,
    dim_length: L, dim_depth: D, dim_height: H,
    dim_adjustable: f.dimAdjustable,
    dim_length_max: f.dimAdjustable ? num(f.dimLengthMax) : null,
    dim_depth_max: f.dimAdjustable ? num(f.dimDepthMax) : null,
    dim_height_max: f.dimAdjustable ? num(f.dimHeightMax) : null,
    dim_note: f.dimNote.trim() || null,
    dimensions: dimensionsLine(f) || null,
    features: f.features.map((s) => s.trim()).filter(Boolean),
    availability: f.availability,
    show_price: f.showPrice,
    seo_title: f.seoTitle.trim() || null, seo_title_custom: f.seoTitleCustom,
    seo_description: f.seoDescription.trim() || null, seo_description_custom: f.seoDescriptionCustom,
    handle_custom: f.handleCustom,
    subtitle_custom: f.subtitleCustom,
    image_alts,
    datasheet_url: f.datasheetUrl || null,
    datasheet_name: f.datasheetName || null,
    datasheet: f.datasheet,
    home_order: f.featured ? num(f.homeOrder) ?? 0 : null,
    lead_time: f.leadTime.trim() || null,
    uses: f.uses.trim() || null,
    options: f.options.trim() || null,
  }
  const optionTitle = f.optionTitle.trim() || "Modelo"
  const rows = f.variants.filter((v) => v.title.trim())
  const variants = (rows.length ? rows : [{ id: "", title: "Estándar", sku: "", price: "", length: "", width: "", height: "" }]).map((v, i) => {
    const price = num(v.price)
    return {
      ...(v.id ? { id: v.id } : {}),
      title: v.title.trim(), sku: v.sku.trim() || null, manage_inventory: false,
      options: { [optionTitle]: v.title.trim() },
      length: num(v.length) ?? (i === 0 ? L : null), width: num(v.width) ?? (i === 0 ? D : null), height: num(v.height) ?? (i === 0 ? H : null),
      prices: price ? [{ currency_code: "pab", amount: price }] : [],
    }
  })
  const body: Record<string, unknown> = {
    title: f.title.trim(),
    subtitle: f.subtitle.trim() || null,
    description: f.description.trim() || null,
    handle: f.handle.trim() || suggestHandle(f),
    status: f.status,
    material: f.material || null,
    length: L, width: D, height: H,
    images: f.images.map((i) => ({ url: i.url })),
    thumbnail: f.thumbnail || f.images[0]?.url || null,
    categories: category ? [{ id: category.id }] : [],
    metadata,
    // The option carries one value per variant (its title); the existing option is renamed/extended, never duplicated
    options: [{ ...(existing?.options?.[0]?.id ? { id: existing.options[0].id } : {}), title: optionTitle, values: variants.map((v) => v.title) }],
    variants,
    collection_id: f.featured && featuredCollectionId ? featuredCollectionId : null,
  }
  body.sales_channels = (f.salesChannelIds.length ? f.salesChannelIds : salesChannelId ? [salesChannelId] : []).map((id) => ({ id }))
  return body
}

/** What must exist before the product can be published (kept to the essentials, as agreed). */
export const publishProblems = (f: WebProductForm): string[] => {
  const problems: string[] = []
  if (!f.title.trim()) problems.push("Nombre del producto")
  if (!f.categoryId) problems.push("Categoría")
  if (!f.description.trim()) problems.push("Descripción")
  if (!f.images.length) problems.push("Fotografía principal")
  if (!f.availability) problems.push("Disponibilidad")
  if (!f.salesChannelIds.length) problems.push("Empresa (en qué web se muestra)")
  const titles = f.variants.map((v) => v.title.trim()).filter(Boolean)
  if (new Set(titles.map((t) => t.toLowerCase())).size !== titles.length) problems.push("Variantes con el mismo nombre")
  return problems
}

/* ─── API ──────────────────────────────────────────────────────────────────── */

export const PRODUCT_FIELDS = "id,title,subtitle,description,handle,status,thumbnail,material,length,width,height,metadata,collection_id,created_at,updated_at,*images,*categories,*collection,*variants,*variants.prices,*options,*options.values,*sales_channels"

const api = <T,>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}) =>
  sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body, query: init.query })

export const listWebProducts = (query: { q?: string; status?: "draft" | "published"; limit?: number; offset?: number; sales_channel_id?: string[] }) =>
  sdk.admin.product.list({ ...query, status: query.status ? [query.status] : undefined, fields: "id,title,subtitle,handle,status,thumbnail,material,metadata,updated_at,*categories,*variants,*variants.prices,*sales_channels", order: "-updated_at" } as HttpTypes.AdminProductListParams)
export const getWebProduct = (id: string) => sdk.admin.product.retrieve(id, { fields: PRODUCT_FIELDS })
export const findByHandle = async (handle: string) => (await sdk.admin.product.list({ handle, fields: "id,handle" } as HttpTypes.AdminProductListParams)).products
export const createWebProduct = (body: Record<string, unknown>) => sdk.admin.product.create(body as unknown as HttpTypes.AdminCreateProduct, { fields: PRODUCT_FIELDS })
export const deleteWebProduct = (id: string) => sdk.admin.product.delete(id)
export const deleteVariant = (productId: string, variantId: string) => sdk.admin.product.deleteVariant(productId, variantId)
export const featuredCollectionId = async (): Promise<string | null> => {
  const { collections } = await sdk.admin.productCollection.list({ handle: FEATURED_COLLECTION_HANDLE, limit: 1 } as HttpTypes.AdminCollectionListParams)
  return collections?.[0]?.id || null
}
export const updateWebProduct = (id: string, body: Record<string, unknown>) => sdk.admin.product.update(id, body as unknown as HttpTypes.AdminUpdateProduct, { fields: PRODUCT_FIELDS })

export const listCategories = async (): Promise<Category[]> => {
  const { product_categories } = await sdk.admin.productCategory.list({ limit: 200, fields: "id,name,handle,parent_category_id,rank" } as HttpTypes.AdminProductCategoryListParams)
  return (product_categories || []).map((c) => ({ id: c.id, name: c.name, handle: c.handle, parent_category_id: c.parent_category_id || null }))
}
export const defaultSalesChannelId = async (): Promise<string | null> => {
  const { sales_channels } = await sdk.admin.salesChannel.list({ limit: 20 })
  return sales_channels?.find((s) => /default/i.test(s.name))?.id || sales_channels?.[0]?.id || null
}

export const productPreviewUrl = (handle: string) => api<{ url: string | null }>(`/admin/product-preview-url/${encodeURIComponent(handle)}`)

/** Builds/links the datasheet PDF (only when its content changed, unless `force`). */
export const generateDatasheet = (id: string, force = false) => api<{ generated: boolean; mode: string; url?: string }>(`/admin/web-products/${id}/datasheet`, { method: "POST", body: { force } })

export const listMaterials = () => api<{ materials: Material[] }>("/admin/materials")
export const createMaterial = (name: string) => api<{ material: Material }>("/admin/materials", { method: "POST", body: { name } })
export const updateMaterial = (id: string, body: Partial<Pick<Material, "name" | "active" | "sort_order">>) => api<{ material: Material }>(`/admin/materials/${id}`, { method: "POST", body })
export const deleteMaterial = (id: string) => api<{ id: string }>(`/admin/materials/${id}`, { method: "DELETE" })

export const listRedirects = (product_id: string) => api<{ redirects: { id: string; from_handle: string; to_handle: string }[] }>("/admin/product-redirects", { query: { product_id } })
export const createRedirect = (from_handle: string, to_handle: string, product_id: string) =>
  api<{ redirects: { id: string; from_handle: string; to_handle: string }[] }>("/admin/product-redirects", { method: "POST", body: { from_handle, to_handle, product_id } })

export interface UploadedFile { id: string; url: string; name: string; width?: number; height?: number; size?: number; optimized?: boolean }

/** Photos go through /admin/web-uploads (EXIF rotation, max 1600 px, WebP); PDFs are stored as sent. `raw` keeps images untouched (logos). */
export async function webUpload(files: File[], raw = false): Promise<UploadedFile[]> {
  const form = new FormData()
  for (const f of files) form.append("files", f)
  const res = await fetch(`/admin/web-uploads${raw ? "?raw=1" : ""}`, { method: "POST", body: form, credentials: "include" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Error ${res.status} al subir`)
  return body.files as UploadedFile[]
}

export const errorMessage = (e: unknown, fallback: string) => {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message
  return fallback
}

export const fmtDate = (iso: string) => new Intl.DateTimeFormat("es-PA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

export const STOREFRONT_URL = "https://karvenmedical.com"
