import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ACTIVITY_FIELDS, clean, logEvent, serializeActivity, serializeResource, workshopService, type Loose } from "../../helpers"

/**
 * After planning or starting an activity, moves the order forward (never back):
 * preparation → scheduled when it gets a date, preparation/scheduled → in_progress when work starts.
 */
async function advanceOrder(req: AuthenticatedMedusaRequest, orderId: string) {
  const service = workshopService(req)
  const order = await service.retrieveWorkOrder(orderId)
  if (order.stage !== "preparation" && order.stage !== "scheduled") return
  const acts = await service.listWorkActivities({ order_id: orderId }, { select: ["status", "date"] })
  const started = acts.some((a) => a.status !== "pending")
  const next = started ? "in_progress" : order.stage === "preparation" && acts.some((a) => a.date) ? "scheduled" : null
  if (!next || next === order.stage) return
  await service.updateWorkOrders({ id: orderId, stage: next })
  await logEvent(req, orderId, "stage", `${order.stage === "preparation" ? "Preparación" : "Programado"} → ${next === "in_progress" ? "En proceso" : "Programado"} (automático)`, { from: order.stage, to: next, auto: true })
}

/** Warns when the person goes over their daily capacity that day (it does not block: the workshop decides). */
async function overload(req: AuthenticatedMedusaRequest, a: Loose): Promise<string[]> {
  if (!a.date || !a.resource_id || a.status === "done") return []
  const service = workshopService(req)
  const [resource] = await service.listWorkshopResources({ id: a.resource_id })
  if (!resource) return []
  const same = await service.listWorkActivities({ date: a.date, resource_id: a.resource_id }, { select: ["hours", "status"] })
  const hours = same.filter((x) => x.status !== "done").reduce((s, x) => s + (Number(x.hours) || 0), 0)
  const cap = serializeResource(resource).daily_capacity
  return hours > cap ? [`${resource.name} tiene ${hours} h planificadas el ${a.date.split("-").reverse().join("/")} (capacidad diaria ${cap} h).`] : []
}

/** POST /admin/workshop/activities/:id — date, person, hours, status… Returns overload warnings. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  const before = await service.retrieveWorkActivity(id)
  const activity = await service.updateWorkActivities({ id, ...clean(req.validatedBody, ACTIVITY_FIELDS) } as Loose)
  if (before.status !== activity.status && activity.status === "done") await logEvent(req, activity.order_id, "activity", `Actividad terminada: ${activity.name}`)
  await advanceOrder(req, activity.order_id)
  res.json({ activity: serializeActivity(activity), warnings: await overload(req, activity) })
}

/** DELETE /admin/workshop/activities/:id */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await workshopService(req).softDeleteWorkActivities([req.params.id])
  res.json({ id: req.params.id, object: "work_activity", deleted: true })
}
