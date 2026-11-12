import { MedusaService } from "@medusajs/framework/utils"
import Project from "./models/project"
import ProjectRevision from "./models/project-revision"

export type ProjectLine = "medico" | "veterinario" | "tecnico"
export type ProjectStatus = "draft" | "review" | "approved" | "published"
export type GalleryItem = { type: "image" | "video" | "embed"; url: string; alt?: string | null; poster?: string | null }

/** Allowed editorial moves. Any status can go back to draft; publishing requires approval. */
export const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ["review"],
  review: ["approved", "draft"],
  approved: ["published", "draft"],
  published: ["draft"],
}

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

class ProjectModuleService extends MedusaService({ Project, ProjectRevision }) {
  /** Returns `base`, or `base-2`, `base-3`... if another (non-deleted) project already uses it. */
  async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base) || "proyecto"
    const existing = await this.listProjects({ slug: { $like: `${root}%` } }, { select: ["id", "slug"] })
    const taken = new Set(existing.filter((p) => p.id !== excludeId).map((p) => p.slug))
    if (!taken.has(root)) return root
    for (let i = 2; i < 1000; i++) {
      const candidate = `${root}-${i}`
      if (!taken.has(candidate)) return candidate
    }
    return `${root}-${Date.now()}`
  }
}

export default ProjectModuleService
