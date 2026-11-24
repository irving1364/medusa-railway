import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { purchaseService } from "../../purchases/helpers"
import { serializeResource, workshopService, type Loose } from "../helpers"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MS_DAY = 86400000
/** Calendar day in Panama (UTC-5) of a timestamp. */
const panamaDay = (ts: string | Date | null | undefined) => (ts ? new Date(new Date(ts).getTime() - 5 * 3600000).toISOString().slice(0, 10) : null)
const between = (d: string | null, from: string, to: string) => !!d && d >= from && d <= to
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / MS_DAY)
const mondayOf = (s: string) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const plus = (s: string, n: number) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const avg = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
const OPEN = ["preparation", "scheduled", "in_progress", "inspection"]
const BEFORE_INSPECTION = ["preparation", "scheduled", "in_progress"]
const AFTER_WORK = ["inspection", "released", "delivered", "closed"]

/** Splits a history note ("A · Bloqueo: x · B") and tells whether it opened or resolved a blocker. */
const blockerOf = (e: Loose): { kind: "open" | "resolve"; cause: string } | null => {
  if (e.data && typeof e.data.blocked === "boolean") {
    const part = String(e.note || "").split(" · ").find((p) => p.startsWith("Bloqueo")) || ""
    return { kind: e.data.blocked ? "open" : "resolve", cause: part.replace(/^Bloqueo( resuelto)?:?\s*/, "") }
  }
  for (const p of String(e.note || "").split(" · ")) {
    if (p.startsWith("Bloqueo resuelto")) return { kind: "resolve", cause: p.replace(/^Bloqueo resuelto:?\s*/, "") }
    if (p.startsWith("Bloqueo:")) return { kind: "open", cause: p.replace(/^Bloqueo:\s*/, "") }
  }
  return null
}

/**
 * GET /admin/workshop/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&company=
 * On-time delivery (against the first committed date), lead time, throughput per week, planned vs real hours
 * per operation and per person, rework, blockers and materials consumed in the period.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const from = String(req.query.from || ""), to = String(req.query.to || "")
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Rango de fechas no válido")
  if (daysBetween(from, to) > 800) throw new MedusaError(MedusaError.Types.INVALID_DATA, "El periodo no puede superar dos años")
  const company = req.query.company === "fabmetal" || req.query.company === "karven" ? String(req.query.company) : null
  const service = workshopService(req)
  const today = panamaDay(new Date()) as string

  const orders = await service.listWorkOrders(company ? { company } : {}, { take: 10000 })
  const ids = orders.map((o) => o.id)
  const byId = new Map(orders.map((o) => [o.id, o as Loose]))
  const [events, activities, resources] = await Promise.all([
    ids.length ? service.listWorkEvents({ order_id: ids }, { order: { created_at: "ASC" }, take: 100000 }) : [],
    ids.length ? service.listWorkActivities({ order_id: ids }, { take: 100000 }) : [],
    service.listWorkshopResources({}, { withDeleted: true } as Loose),
  ])
  const ref = (o: Loose) => ({ id: o.id, number: o.number, title: o.title, client_name: o.client_name || null, type: o.type })

  /* ─── Deliveries ─── */
  const delivered = orders.filter((o) => between(panamaDay(o.delivered_at), from, to)).map((o) => {
    const day = panamaDay(o.delivered_at) as string
    const due = (o.original_due_date || o.due_date || null) as string | null
    return { ...ref(o), delivered: day, due, late_days: due ? Math.max(0, daysBetween(due, day)) : null, lead_days: Math.max(0, daysBetween(panamaDay(o.created_at) as string, day)), moved: !!(o.original_due_date && o.due_date && o.original_due_date !== o.due_date) }
  })
  const withDue = delivered.filter((d) => d.due)
  const onTime = withDue.filter((d) => (d.late_days || 0) === 0)
  const weeks: { week: string; on_time: number; late: number; no_date: number }[] = []
  for (let w = mondayOf(from); w <= to; w = plus(w, 7)) weeks.push({ week: w, on_time: 0, late: 0, no_date: 0 })
  for (const d of delivered) {
    const w = weeks.find((x) => d.delivered >= x.week && d.delivered < plus(x.week, 7))
    if (w) { if (!d.due) w.no_date++; else if (d.late_days) w.late++; else w.on_time++ }
  }
  const typeCount = (list: Loose[]) => ({ fabrication: list.filter((o) => o.type === "fabrication").length, repair: list.filter((o) => o.type === "repair").length, maintenance: list.filter((o) => o.type === "maintenance").length })
  const created = orders.filter((o) => between(panamaDay(o.created_at), from, to))
  const cancelled = events.filter((e) => e.action === "stage" && (e.data as Loose)?.to === "cancelled" && between(panamaDay(e.created_at), from, to)).length
  const openNow = orders.filter((o) => OPEN.includes(o.stage))

  /* ─── Hours ─── */
  const inRange = activities.filter((a) => between(a.date, from, to))
  const n = (v: unknown) => Number(v) || 0
  const measured = inRange.filter((a) => a.status === "done" && a.actual_hours !== null && a.actual_hours !== undefined)
  const ops = new Map<string, { name: string; count: number; planned: number; measured: number; planned_measured: number; actual: number }>()
  for (const a of inRange) {
    const key = String(a.name).trim().toLowerCase()
    const op = ops.get(key) || { name: String(a.name).trim(), count: 0, planned: 0, measured: 0, planned_measured: 0, actual: 0 }
    op.count++; op.planned += n(a.hours)
    if (a.status === "done" && a.actual_hours !== null && a.actual_hours !== undefined) { op.measured++; op.planned_measured += n(a.hours); op.actual += n(a.actual_hours) }
    ops.set(key, op)
  }
  const weeksInRange = (daysBetween(from, to) + 1) / 7
  const people = resources.map(serializeResource).map((r) => {
    const mine = inRange.filter((a) => a.resource_id === r.id)
    const planned = mine.reduce((t, a) => t + n(a.hours), 0)
    const capacity = r1(r.weekly_capacity * weeksInRange)
    return { id: r.id, name: r.name, role: r.role, planned: r1(planned), done: r1(mine.filter((a) => a.status === "done").reduce((t, a) => t + n(a.hours), 0)), actual: r1(mine.reduce((t, a) => t + n(a.actual_hours), 0)), capacity, utilization: capacity ? Math.round((planned / capacity) * 100) : null, active: r.active && !r.deleted_at }
  }).filter((p) => p.active || p.planned > 0)
  const unassigned = r1(inRange.filter((a) => !a.resource_id).reduce((t, a) => t + n(a.hours), 0))

  /* ─── Rework and blockers (from the history) ─── */
  const rework = events.filter((e) => e.action === "stage" && between(panamaDay(e.created_at), from, to) && AFTER_WORK.includes((e.data as Loose)?.from) && BEFORE_INSPECTION.includes((e.data as Loose)?.to))
    .map((e) => ({ ...ref(byId.get(e.order_id) || { id: e.order_id }), from: (e.data as Loose).from, to: (e.data as Loose).to, date: panamaDay(e.created_at), actor: e.actor_email }))
  const opened = new Map<string, number>()
  const blockers: { order: Loose; cause: string; date: string | null }[] = []
  const resolveDays: number[] = []
  for (const e of events) {
    const b = blockerOf(e)
    if (!b) continue
    const t = new Date(e.created_at).getTime()
    if (b.kind === "open") {
      opened.set(e.order_id, t)
      if (between(panamaDay(e.created_at), from, to)) blockers.push({ order: ref(byId.get(e.order_id) || { id: e.order_id }), cause: b.cause || "Sin causa indicada", date: panamaDay(e.created_at) })
    } else if (opened.has(e.order_id)) {
      if (between(panamaDay(e.created_at), from, to)) resolveDays.push((t - (opened.get(e.order_id) as number)) / MS_DAY)
      opened.delete(e.order_id)
    }
  }
  const causes = new Map<string, number>()
  for (const b of blockers) { const k = b.cause.trim(); causes.set(k, (causes.get(k) || 0) + 1) }

  /* ─── Materials consumed (stock movements of the work orders) ─── */
  let materials: Loose[] = []
  if (ids.length) {
    const purchases = purchaseService(req)
    const moves = (await purchases.listStockMovements({ ref_type: "work_order", ref_id: ids, reason: ["consumption", "return"] } as Loose, { take: 100000 }))
      .filter((m) => between(panamaDay(m.created_at), from, to))
    const itemIds = [...new Set(moves.map((m) => m.item_id))]
    const items = itemIds.length ? await purchases.listPurchaseItems({ id: itemIds }, { withDeleted: true } as Loose) : []
    const itemById = new Map(items.map((i) => [i.id, i as Loose]))
    const agg = new Map<string, Loose>()
    for (const m of moves) {
      const it = itemById.get(m.item_id) || {}
      const row = agg.get(m.item_id) || { item_id: m.item_id, name: it.name || "Material eliminado", ref: it.ref || null, unit: it.unit || "", quantity: 0, orders: new Set<string>(), price: it.last_price === null || it.last_price === undefined ? null : n(it.last_price) }
      row.quantity -= n(m.quantity)
      if (m.ref_id) row.orders.add(m.ref_id)
      agg.set(m.item_id, row)
    }
    materials = [...agg.values()].filter((r) => Math.abs(r.quantity) > 1e-9).map((r) => ({ ...r, quantity: Math.round(r.quantity * 1000) / 1000, orders: r.orders.size, cost: r.price === null ? null : r2(r.quantity * r.price) })).sort((a, b) => (b.cost || 0) - (a.cost || 0))
  }

  const plannedMeasured = measured.reduce((t, a) => t + n(a.hours), 0)
  const actualMeasured = measured.reduce((t, a) => t + n(a.actual_hours), 0)
  res.json({
    from, to, company,
    summary: {
      delivered: delivered.length,
      on_time: onTime.length,
      with_due: withDue.length,
      on_time_pct: withDue.length ? Math.round((onTime.length / withDue.length) * 100) : null,
      avg_late_days: avg(withDue.filter((d) => d.late_days).map((d) => d.late_days as number)),
      avg_lead_days: avg(delivered.map((d) => d.lead_days)),
      created: created.length,
      created_by_type: typeCount(created),
      delivered_by_type: typeCount(delivered),
      cancelled,
      open_now: openNow.length,
      overdue_now: openNow.filter((o) => o.due_date && o.due_date < today).length,
      hours_planned: r1(inRange.reduce((t, a) => t + n(a.hours), 0)),
      hours_done: r1(inRange.filter((a) => a.status === "done").reduce((t, a) => t + n(a.hours), 0)),
      hours_measured_planned: r1(plannedMeasured),
      hours_measured_actual: r1(actualMeasured),
      hours_deviation_pct: plannedMeasured ? Math.round(((actualMeasured - plannedMeasured) / plannedMeasured) * 100) : null,
      measured_activities: measured.length,
      rework: rework.length,
      blockers_new: blockers.length,
      blockers_now: openNow.filter((o) => o.blocked).length,
      avg_block_days: avg(resolveDays),
      materials_cost: r2(materials.reduce((t, m) => t + (m.cost || 0), 0)),
      materials_unpriced: materials.filter((m) => m.cost === null).length,
    },
    weeks,
    late: delivered.filter((d) => d.late_days).sort((a, b) => (b.late_days || 0) - (a.late_days || 0)),
    delivered: delivered.sort((a, b) => a.delivered.localeCompare(b.delivered)),
    operations: [...ops.values()].map((o) => ({ ...o, planned: r1(o.planned), planned_measured: r1(o.planned_measured), actual: r1(o.actual), deviation_pct: o.planned_measured ? Math.round(((o.actual - o.planned_measured) / o.planned_measured) * 100) : null })).sort((a, b) => b.planned - a.planned),
    people,
    unassigned_hours: unassigned,
    rework,
    blocker_causes: [...causes.entries()].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count),
    blockers,
    materials,
  })
}
