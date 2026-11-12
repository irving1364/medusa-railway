import { sdk } from "./sdk"

export type ProjectLine = "medico" | "veterinario" | "tecnico"
export type ProjectStatus = "draft" | "review" | "approved" | "published"
export type GalleryItem = { type: "image" | "video" | "embed"; url: string; alt?: string | null; poster?: string | null }

export interface Project {
  id: string
  title: string
  slug: string
  line: ProjectLine
  specialty: string | null
  work_type: string | null
  client_name: string | null
  location: string | null
  year: number | null
  summary: string | null
  client_need: string | null
  solution: string | null
  fabrication: string | null
  cover_url: string | null
  cover_alt: string | null
  gallery: GalleryItem[]
  related_product_ids: string[]
  seo_title: string | null
  seo_description: string | null
  status: ProjectStatus
  published_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  public_url: string
  preview_url: string | null
}

export interface Revision {
  id: string
  action: "created" | "updated" | "status" | "archived" | "restored"
  from_status: ProjectStatus | null
  to_status: ProjectStatus | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  note: string | null
  actor_email: string | null
  created_at: string
}

export type ProjectInput = Omit<Project, "id" | "status" | "published_at" | "created_at" | "updated_at" | "deleted_at" | "public_url" | "preview_url">

export const LINES: { value: ProjectLine; label: string }[] = [
  { value: "medico", label: "Mobiliario médico" },
  { value: "veterinario", label: "Mobiliario veterinario" },
  { value: "tecnico", label: "Mobiliario técnico" },
]
export const lineLabel = (v: ProjectLine) => LINES.find((l) => l.value === v)?.label || v

export const STATUS: Record<ProjectStatus, { label: string; color: "grey" | "orange" | "blue" | "green"; step: number }> = {
  draft: { label: "Borrador", color: "grey", step: 0 },
  review: { label: "En revisión", color: "orange", step: 1 },
  approved: { label: "Aprobado", color: "blue", step: 2 },
  published: { label: "Publicado", color: "green", step: 3 },
}
export const STEPS: { status: ProjectStatus; label: string }[] = [
  { status: "draft", label: "Borrador" },
  { status: "review", label: "Revisión" },
  { status: "approved", label: "Aprobación" },
  { status: "published", label: "Publicación" },
]

export const FIELD_LABELS: Record<string, string> = {
  title: "Título", slug: "URL", line: "Línea", specialty: "Especialidad", work_type: "Tipo de trabajo",
  client_name: "Cliente", location: "Ubicación", year: "Año", summary: "Resumen", client_need: "Necesidad del cliente",
  solution: "Solución desarrollada", fabrication: "Fabricación y verificación", cover_url: "Portada", cover_alt: "Texto alternativo de portada",
  gallery: "Galería", related_product_ids: "Productos relacionados", seo_title: "Título SEO", seo_description: "Descripción SEO", sort_order: "Orden",
}

export const emptyProject = (): ProjectInput => ({
  title: "", slug: "", line: "medico", specialty: "", work_type: "", client_name: "", location: "", year: null, summary: "",
  client_need: "", solution: "", fabrication: "", cover_url: null, cover_alt: "", gallery: [], related_product_ids: [],
  seo_title: "", seo_description: "", sort_order: 0,
})

export const slugify = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)

export const fmtDate = (iso: string) => new Intl.DateTimeFormat("es-PA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

const api = <T,>(path: string, init: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}) =>
  sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body, query: init.query })

export const listProjects = (query: Record<string, string | number | undefined>) =>
  api<{ projects: Project[]; count: number }>("/admin/projects", { query })
export const getProject = (id: string) => api<{ project: Project }>(`/admin/projects/${id}`)
export const createProject = (body: ProjectInput) => api<{ project: Project }>("/admin/projects", { method: "POST", body })
export const updateProject = (id: string, body: Partial<ProjectInput>) => api<{ project: Project }>(`/admin/projects/${id}`, { method: "POST", body })
export const archiveProject = (id: string) => api<{ id: string }>(`/admin/projects/${id}`, { method: "DELETE" })
export const restoreProject = (id: string) => api<{ project: Project }>(`/admin/projects/${id}/restore`, { method: "POST" })
export const setProjectStatus = (id: string, status: ProjectStatus, note?: string) =>
  api<{ project: Project }>(`/admin/projects/${id}/status`, { method: "POST", body: { status, note: note || null } })
export const listRevisions = (id: string) => api<{ revisions: Revision[] }>(`/admin/projects/${id}/revisions`)

/** Uploads through the file module; returns public URLs on the Railway volume. */
export async function uploadFiles(files: File[]): Promise<{ url: string; name: string }[]> {
  const { files: uploaded } = await sdk.admin.upload.create({ files })
  return (uploaded || []).map((f, i) => ({ url: f.url, name: files[i]?.name || f.id }))
}

export const errorMessage = (e: unknown, fallback: string) => {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message
  return fallback
}
