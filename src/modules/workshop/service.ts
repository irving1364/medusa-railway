import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import WorkActivity from "./models/work-activity"
import WorkEvent from "./models/work-event"
import WorkMaterial from "./models/work-material"
import WorkPhoto from "./models/work-photo"
import WorkOrder from "./models/work-order"
import WorkshopResource from "./models/workshop-resource"

export type WorkType = "fabrication" | "repair" | "maintenance"
export type WorkStage = "preparation" | "scheduled" | "in_progress" | "inspection" | "released" | "delivered" | "closed" | "cancelled"
export interface CheckItem { label: string; done: boolean }

type Loose = Record<string, any>

/** Inspection checklist copied into every new order (editable per order afterwards). */
export const CHECKLISTS: Record<WorkType, string[]> = {
  fabrication: ["Dimensiones y configuración", "Estabilidad y uniones", "Bordes y acabado", "Movilidad / mecanismos si aplican", "Limpieza y documentación fotográfica"],
  repair: ["Diagnóstico y alcance aprobado", "Reparación ejecutada", "Verificación funcional y seguridad", "Fotos y registro de intervención"],
  maintenance: ["Equipo identificado y alcance", "Componentes revisados", "Prueba funcional aplicable", "Registro y recomendaciones"],
}

/** OP-00001 for fabrication, OT-00001 for repairs and maintenance. */
export const PREFIX: Record<WorkType, string> = { fabrication: "OP", repair: "OT", maintenance: "OT" }

/** Stages that mean the job left the workshop with quality approval. */
export const AFTER_RELEASE: WorkStage[] = ["released", "delivered", "closed"]
export const OPEN_STAGES: WorkStage[] = ["preparation", "scheduled", "in_progress", "inspection"]

export const checklistFor = (type: WorkType): CheckItem[] => CHECKLISTS[type].map((label) => ({ label, done: false }))
export const checklistComplete = (list: unknown): boolean => Array.isArray(list) && list.length > 0 && list.every((c: Loose) => !!c?.done)

const fail = (msg: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, msg)

class WorkshopModuleService extends MedusaService({ WorkOrder, WorkActivity, WorkshopResource, WorkEvent, WorkMaterial, WorkImage: WorkPhoto }) {
  /** Next free number for the prefix, taken from the highest existing one (deleted orders included, numbers are never reused). */
  async nextNumber(type: WorkType): Promise<string> {
    const prefix = PREFIX[type]
    const existing = await this.listWorkOrders({ number: { $like: `${prefix}-%` } } as Loose, { select: ["number"], withDeleted: true } as Loose)
    const max = existing.reduce((m, o) => Math.max(m, Number(String(o.number).slice(prefix.length + 1)) || 0), 0)
    return `${prefix}-${String(max + 1).padStart(5, "0")}`
  }

  /**
   * Validates a stage change against the rules of the workshop:
   * - released needs the checklist complete and no active blocker (that is the quality release);
   * - delivered / closed need a previous release (a job that will not be done is cancelled instead);
   * - a cancelled order can only be reopened to preparation.
   * Returns the timestamps to store with the change.
   */
  stageChange(order: Loose, next: WorkStage, actor: string | null): Loose {
    const current = order.stage as WorkStage
    if (current === next) return {}
    if (current === "cancelled" && next !== "preparation") throw fail("Una orden cancelada solo puede reabrirse en Preparación.")
    const now = new Date()
    const patch: Loose = { stage: next }
    if (next === "released") {
      if (order.blocked) throw fail("La orden tiene un bloqueo activo. Resuélvalo antes de liberar.")
      if (!checklistComplete(order.checklist)) throw fail("Complete toda la lista de inspección antes de liberar la orden.")
      patch.inspected_at = order.inspected_at || now
      patch.inspected_by = order.inspected_by || actor
      patch.released_at = now
    }
    if (next === "delivered" || next === "closed") {
      if (!order.released_at) throw fail(`La orden debe estar liberada por calidad antes de ${next === "delivered" ? "entregarse" : "cerrarse"}. Si no se va a hacer, cancélela.`)
      if (next === "delivered") patch.delivered_at = now
      if (next === "closed") patch.closed_at = now
    }
    // Going back before the release invalidates it: it must be inspected again.
    if (!AFTER_RELEASE.includes(next) && next !== "cancelled") Object.assign(patch, { released_at: null, delivered_at: null, closed_at: null, inspected_at: null, inspected_by: null })
    return patch
  }
}

export default WorkshopModuleService
