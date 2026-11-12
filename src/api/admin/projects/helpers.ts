import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { PROJECT_MODULE } from "../../../modules/project"
import type ProjectModuleService from "../../../modules/project/service"

export const STOREFRONT_URL = (process.env.STOREFRONT_URL || "https://karvenmedical.com").replace(/\/$/, "")
const PREVIEW_SECRET = process.env.PROJECT_PREVIEW_SECRET || ""

export const projectService = (req: AuthenticatedMedusaRequest | { scope: any }) =>
  req.scope.resolve(PROJECT_MODULE) as ProjectModuleService

/** Public and preview URLs for the admin ("Ver en la web" / "Vista previa"). */
/** Loosely typed row for service calls (DML infers enum/json fields as unknown). */
export type Loose = Record<string, any>

export const withUrls = <T extends { slug: string }>(project: T) => ({
  ...project,
  public_url: `${STOREFRONT_URL}/proyectos/${project.slug}`,
  preview_url: PREVIEW_SECRET ? `${STOREFRONT_URL}/proyectos/${project.slug}?preview=${PREVIEW_SECRET}` : null,
})

/** Who is acting, for the history. */
export async function actorOf(req: AuthenticatedMedusaRequest): Promise<{ actor_id: string | null; actor_email: string | null }> {
  const actor_id = req.auth_context?.actor_id || null
  if (!actor_id) return { actor_id: null, actor_email: null }
  try {
    const userService = req.scope.resolve(Modules.USER) as { retrieveUser: (id: string) => Promise<{ email?: string }> }
    const user = await userService.retrieveUser(actor_id)
    return { actor_id, actor_email: user?.email || null }
  } catch {
    return { actor_id, actor_email: null }
  }
}

const TRACKED = [
  "title", "slug", "line", "specialty", "work_type", "client_name", "location", "year", "summary",
  "client_need", "solution", "fabrication", "cover_url", "cover_alt", "gallery", "related_product_ids",
  "seo_title", "seo_description", "sort_order",
] as const

const brief = (v: unknown): unknown => {
  if (v === undefined) return null
  if (Array.isArray(v)) return `${v.length} elemento${v.length === 1 ? "" : "s"}`
  if (typeof v === "string") return v.length > 160 ? `${v.slice(0, 157)}...` : v
  return v
}

/** { field: { from, to } } for the fields that actually changed. */
export function diffProject(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of TRACKED) {
    if (!(key in after)) continue
    const a = JSON.stringify(before[key] ?? null)
    const b = JSON.stringify(after[key] ?? null)
    if (a !== b) changes[key] = { from: brief(before[key]), to: brief(after[key]) }
  }
  return changes
}
