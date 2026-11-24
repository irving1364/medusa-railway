import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tools } from "@medusajs/icons"
import { Badge, Button, Container, FocusModal, Heading, Input, Select, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import ActivityDrawer from "../../components/activity-drawer"
import CompanySwitcher from "../../components/company-switcher"
import WorkOrderForm from "../../components/work-order-form"
import { companyColor, companyLabel, defaultCompanyCode, useCompany } from "../../lib/companies"
import {
  ACTIVITY_TEMPLATES, MATERIALS_LABEL, OPEN_STAGES, STAGE_LABEL, TYPE_LABEL, addDays, createOrder, dayName, dayShort, daysUntil, emptyOrder, errorMessage, fmtDay, getSchedule, getSummary,
  hours, listOrders, listResources, materialsColor, mondayOf, stageColor, today, updateActivity, weekLabel, weekPdfUrl,
  type Activity, type ActivityInput, type OrderInput, type Resource, type Schedule, type Summary, type WorkOrder,
} from "../../lib/workshop"

type Tab = "plan" | "orders" | "blocks"
type Mode = "week" | "load" | "timeline"

/* ─── Top counters ─── */

const Metric = ({ label, value, hint, tone }: { label: string; value: number | string; hint: string; tone?: "warn" | "danger" }) => (
  <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <Text size="xsmall" className="text-ui-fg-subtle">{label}</Text>
    <Text className={`mt-2 text-2xl font-semibold ${tone === "danger" ? "text-ui-fg-error" : tone === "warn" ? "text-ui-tag-orange-text" : "text-ui-fg-base"}`}>{value}</Text>
    <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text>
  </div>
)

/* ─── Week board ─── */

function ActivityCard({ a, order, resource, onOpen, compact }: { a: Activity; order?: WorkOrder; resource?: Resource; onOpen: () => void; compact?: boolean }) {
  const tone = order?.blocked ? "border-l-ui-tag-red-icon bg-ui-tag-red-bg" : a.status === "done" ? "border-l-ui-tag-green-icon bg-ui-tag-green-bg" : a.status === "in_progress" ? "border-l-ui-tag-blue-icon bg-ui-tag-blue-bg" : "border-l-ui-tag-neutral-icon bg-ui-bg-subtle"
  const onDragStart = (e: DragEvent) => { e.dataTransfer.setData("text/activity", a.id); e.dataTransfer.effectAllowed = "move" }
  return (
    <button type="button" draggable onDragStart={onDragStart} onClick={onOpen}
      className={`w-full cursor-grab rounded-md border border-ui-border-base border-l-4 p-2 text-left transition-shadow hover:shadow-elevation-card-hover active:cursor-grabbing ${tone}`}>
      <Text size="xsmall" weight="plus" className={`leading-tight ${a.status === "done" ? "line-through opacity-70" : ""}`}>{a.name}</Text>
      <Text size="xsmall" className="text-ui-fg-subtle leading-tight">{order?.number || "—"}{!compact && order ? ` · ${order.title}` : ""}</Text>
      <Text size="xsmall" className="text-ui-fg-muted leading-tight">{resource?.name || "Sin asignar"} · {hours(a.hours)}</Text>
      {order?.blocked && <Badge size="2xsmall" color="red" className="mt-1">Bloqueada</Badge>}
    </button>
  )
}

function DropZone({ onDrop, className, children }: { onDrop: (id: string) => void; className?: string; children: ReactNode }) {
  const [over, setOver] = useState(false)
  return (
    <div className={`${className || ""} ${over ? "ring-2 ring-ui-border-interactive" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("text/activity")) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/activity"); if (id) onDrop(id) }}>
      {children}
    </div>
  )
}

function WeekBoard({ data, days, person, onOpen, onMove }: { data: Schedule; days: string[]; person: string; onOpen: (a: Activity) => void; onMove: (id: string, date: string | null) => void }) {
  const orders = useMemo(() => new Map(data.orders.map((o) => [o.id, o])), [data.orders])
  const people = useMemo(() => new Map(data.resources.map((r) => [r.id, r])), [data.resources])
  const mine = (a: Activity) => !person || (person === "none" ? !a.resource_id : a.resource_id === person)
  const backlog = data.unscheduled.filter(mine)
  const t = today()
  return (
    <div className="grid gap-3 xl:grid-cols-[230px_minmax(0,1fr)]">
      <DropZone onDrop={(id) => onMove(id, null)} className="rounded-lg border border-ui-border-base bg-ui-bg-base p-3 xl:max-h-[70vh] xl:overflow-y-auto">
        <div className="mb-2 flex items-center justify-between"><Text size="small" weight="plus">Por programar</Text><Badge size="2xsmall">{backlog.length}</Badge></div>
        <Text size="xsmall" className="mb-3 text-ui-fg-subtle">Arrastre cada actividad al día en que se hará.</Text>
        <div className="flex flex-col gap-2">
          {backlog.map((a) => <ActivityCard key={a.id} a={a} order={orders.get(a.order_id)} resource={people.get(a.resource_id || "")} onOpen={() => onOpen(a)} />)}
          {backlog.length === 0 && <Text size="xsmall" className="text-ui-fg-muted">Nada pendiente de programar.</Text>}
        </div>
      </DropZone>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const list = data.activities.filter((a) => a.date === d && mine(a))
            const load = new Map<string, number>()
            for (const a of data.activities) if (a.date === d && a.status !== "done" && a.resource_id) load.set(a.resource_id, (load.get(a.resource_id) || 0) + a.hours)
            const over = [...load.entries()].filter(([id, h]) => h > (people.get(id)?.daily_capacity ?? 9))
            return (
              <DropZone key={d} onDrop={(id) => onMove(id, d)} className={`flex min-h-[360px] flex-col gap-2 rounded-lg border p-2 ${d === t ? "border-ui-border-interactive bg-ui-bg-highlight" : "border-ui-border-base bg-ui-bg-subtle"}`}>
                <div className="flex items-baseline justify-between px-1">
                  <Text size="small" weight="plus">{dayName(d)} {dayShort(d)}</Text>
                  <Text size="xsmall" className="text-ui-fg-muted">{hours(list.filter((a) => a.status !== "done").reduce((s, a) => s + a.hours, 0))}</Text>
                </div>
                {over.map(([id, h]) => <Text key={id} size="xsmall" className="px-1 text-ui-fg-error">{people.get(id)?.name}: {hours(h)} (máx. {people.get(id)?.daily_capacity} h)</Text>)}
                {list.map((a) => <ActivityCard key={a.id} compact a={a} order={orders.get(a.order_id)} resource={people.get(a.resource_id || "")} onOpen={() => onOpen(a)} />)}
              </DropZone>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Load per person ─── */

function LoadView({ data, days }: { data: Schedule; days: string[] }) {
  const active = data.resources.filter((r) => r.active && !r.deleted_at)
  const pending = data.activities.filter((a) => a.status !== "done")
  const sum = (rid: string | null, d?: string) => pending.filter((a) => a.resource_id === rid && (!d || a.date === d)).reduce((s, a) => s + a.hours, 0)
  const unassigned = sum(null)
  if (!active.length) return <Text size="small" className="text-ui-fg-subtle">Registre primero las personas del taller en «Recursos».</Text>
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {active.map((r) => {
          const h = sum(r.id), pct = r.weekly_capacity ? Math.min(100, (h / r.weekly_capacity) * 100) : 0
          return (
            <div key={r.id}>
              <div className="mb-1.5 flex justify-between gap-2"><Text size="small" weight="plus">{r.name} <span className="font-normal text-ui-fg-subtle">· {r.role || "—"}</span></Text><Text size="small" className={h > r.weekly_capacity ? "text-ui-fg-error" : ""}>{hours(h)} / {r.weekly_capacity} h</Text></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ui-bg-component"><div className={`h-full rounded-full ${h > r.weekly_capacity ? "bg-ui-tag-red-icon" : "bg-ui-fg-interactive"}`} style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <Table.Header><Table.Row><Table.HeaderCell>Persona</Table.HeaderCell>{days.map((d) => <Table.HeaderCell key={d}>{dayName(d)} {dayShort(d)}</Table.HeaderCell>)}<Table.HeaderCell>Semana</Table.HeaderCell></Table.Row></Table.Header>
          <Table.Body>
            {active.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{r.name}</Table.Cell>
                {days.map((d) => { const h = sum(r.id, d); return <Table.Cell key={d} className={h > r.daily_capacity ? "font-semibold text-ui-fg-error" : h ? "" : "text-ui-fg-muted"}>{h ? hours(h) : "—"}</Table.Cell> })}
                <Table.Cell className="font-semibold">{hours(sum(r.id))}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      {unassigned > 0 && <Text size="small" className="text-ui-tag-orange-text">Hay {hours(unassigned)} programadas esta semana sin responsable.</Text>}
      <Text size="xsmall" className="text-ui-fg-subtle">Solo cuentan las actividades no terminadas. Las capacidades se ajustan en «Recursos».</Text>
    </div>
  )
}

/* ─── Timeline (4 weeks) ─── */

function Timeline({ from, company, onOpenOrder }: { from: string; company?: string; onOpenOrder: (id: string) => void }) {
  const [data, setData] = useState<Schedule | null>(null)
  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(from, i)).filter((d) => dayName(d) !== "Dom"), [from])
  useEffect(() => { setData(null); getSchedule(from, addDays(from, 27), company).then(setData).catch((e) => toast.error(errorMessage(e, "No se pudo cargar el cronograma"))) }, [from, company])
  if (!data) return <Text size="small" className="text-ui-fg-subtle">Cargando…</Text>
  const orders = data.orders.filter((o) => OPEN_STAGES.includes(o.stage) || data.activities.some((a) => a.order_id === o.id))
  if (!orders.length) return <Text size="small" className="text-ui-fg-subtle">No hay órdenes abiertas.</Text>
  const t = today()
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1100px] text-xs" style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(28px, 1fr))` }}>
        <div className="sticky left-0 border-b border-ui-border-base bg-ui-bg-base p-2 font-semibold">Orden</div>
        {days.map((d) => <div key={d} className={`border-b border-l border-ui-border-base p-1 text-center ${d === t ? "bg-ui-bg-highlight font-semibold" : ""} ${dayName(d) === "Lun" ? "border-l-ui-border-strong" : ""}`}>{dayName(d).slice(0, 1)}<br />{d.slice(8)}</div>)}
        {orders.map((o) => {
          const acts = data.activities.filter((a) => a.order_id === o.id)
          const dated = acts.map((a) => a.date as string).sort()
          const start = dated[0], end = dated[dated.length - 1]
          return [
            <button key={o.id} type="button" onClick={() => onOpenOrder(o.id)} className="sticky left-0 border-b border-ui-border-base bg-ui-bg-base p-2 text-left hover:bg-ui-bg-base-hover">
              <span className="font-semibold">{o.number}</span>{o.blocked && <span className="text-ui-fg-error"> · bloqueada</span>}<br /><span className="text-ui-fg-subtle">{o.title}</span>
            </button>,
            ...days.map((d) => {
              const n = acts.filter((a) => a.date === d)
              const inside = start && d >= start && d <= end
              const due = o.due_date === d
              return (
                <div key={o.id + d} title={n.map((a) => a.name).join(", ") || undefined} className={`relative border-b border-l border-ui-border-base ${dayName(d) === "Lun" ? "border-l-ui-border-strong" : ""}`}>
                  {inside && <div className={`absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 ${o.blocked ? "bg-ui-tag-red-bg" : "bg-ui-tag-blue-bg"}`} />}
                  {n.length > 0 && <div className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${n.every((a) => a.status === "done") ? "bg-ui-tag-green-icon" : o.blocked ? "bg-ui-tag-red-icon" : "bg-ui-tag-blue-icon"}`} />}
                  {due && <div className="absolute inset-y-0 right-0 w-1 bg-ui-tag-orange-icon" title={`Entrega ${fmtDay(d)}`} />}
                </div>
              )
            }),
          ]
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ui-fg-subtle">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-ui-tag-blue-icon" /> Día con actividades</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-ui-tag-green-icon" /> Terminadas</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-1 bg-ui-tag-orange-icon" /> Entrega comprometida</span>
      </div>
    </div>
  )
}

/* ─── Orders table ─── */

const STAGE_FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "Abiertas" }, { key: "inspection", label: "En inspección" }, { key: "released", label: "Liberadas" },
  { key: "delivered", label: "Entregadas" }, { key: "closed", label: "Cerradas" }, { key: "cancelled", label: "Canceladas" }, { key: "", label: "Todas" },
]

const DueCell = ({ o }: { o: WorkOrder }) => {
  const n = daysUntil(o.due_date)
  const late = n !== null && n < 0 && OPEN_STAGES.includes(o.stage)
  return <div><Text size="small">{fmtDay(o.due_date)}</Text>{late ? <Text size="xsmall" className="text-ui-fg-error">Atrasada {-n} d</Text> : n !== null && OPEN_STAGES.includes(o.stage) && n <= 3 ? <Text size="xsmall" className="text-ui-tag-orange-text">{n === 0 ? "Hoy" : `En ${n} d`}</Text> : null}</div>
}

function OrdersTable({ company, resources, tick }: { company?: string; resources: Resource[]; tick: number }) {
  const navigate = useNavigate()
  const [stage, setStage] = useState("open")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const people = useMemo(() => new Map(resources.map((r) => [r.id, r.name])), [resources])
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => listOrders({ company, stage: stage || undefined, q: q.trim() || undefined }).then(({ orders }) => setRows(orders)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))).finally(() => setLoading(false)), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [company, stage, q, tick])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">{STAGE_FILTERS.map((f) => <Button key={f.key} size="small" variant={stage === f.key ? "primary" : "transparent"} onClick={() => setStage(f.key)}>{f.label}</Button>)}</div>
        <span className="flex-1" />
        <Input size="small" placeholder="Número, trabajo, cliente o cotización" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Orden</Table.HeaderCell><Table.HeaderCell>Trabajo / cliente</Table.HeaderCell><Table.HeaderCell>Entrega</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell><Table.HeaderCell>Materiales</Table.HeaderCell><Table.HeaderCell>Avance</Table.HeaderCell><Table.HeaderCell>Responsable</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((o) => {
              const p = o.progress
              const pct = p && p.total ? Math.round((p.done / p.total) * 100) : 0
              return (
                <Table.Row key={o.id} className="cursor-pointer" onClick={() => navigate(`/taller/${o.id}`)}>
                  <Table.Cell><Text size="small" weight="plus">{o.number}</Text><div className="flex gap-1"><Badge size="2xsmall" color={companyColor(o.company)}>{companyLabel(o.company)}</Badge></div></Table.Cell>
                  <Table.Cell className="max-w-[320px]"><Text size="small" weight="plus" className="truncate">{o.title}{o.quantity > 1 ? ` ×${o.quantity}` : ""}</Text><Text size="xsmall" className="truncate text-ui-fg-subtle">{TYPE_LABEL[o.type]}{o.client_name ? ` · ${o.client_name}` : ""}</Text></Table.Cell>
                  <Table.Cell><DueCell o={o} /></Table.Cell>
                  <Table.Cell><div className="flex flex-wrap gap-1"><Badge size="2xsmall" color={stageColor(o.stage)}>{STAGE_LABEL[o.stage]}</Badge>{o.blocked && <Badge size="2xsmall" color="red">Bloqueo</Badge>}</div></Table.Cell>
                  <Table.Cell><Badge size="2xsmall" color={materialsColor(o.materials)}>{MATERIALS_LABEL[o.materials]}</Badge></Table.Cell>
                  <Table.Cell>
                    {p && p.activities ? <div className="w-28"><div className="h-1.5 overflow-hidden rounded-full bg-ui-bg-component"><div className="h-full bg-ui-tag-green-icon" style={{ width: `${pct}%` }} /></div><Text size="xsmall" className="text-ui-fg-subtle">{pct}% · {hours(p.total)}{p.unscheduled ? ` · ${p.unscheduled} sin fecha` : ""}</Text></div> : <Text size="xsmall" className="text-ui-fg-muted">Sin operaciones</Text>}
                  </Table.Cell>
                  <Table.Cell><Text size="small">{(o.owner_id && people.get(o.owner_id)) || "—"}</Text></Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      </div>
      {!loading && rows.length === 0 && <Text size="small" className="py-6 text-center text-ui-fg-subtle">No hay órdenes con este filtro.</Text>}
    </div>
  )
}

/* ─── Blockers and materials ─── */

function BlocksView({ company, tick }: { company?: string; tick: number }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WorkOrder[] | null>(null)
  useEffect(() => { listOrders({ company, stage: "open" }).then(({ orders }) => setRows(orders)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))) }, [company, tick])
  if (!rows) return <Text size="small" className="text-ui-fg-subtle">Cargando…</Text>
  const blocked = rows.filter((o) => o.blocked)
  const materials = rows.filter((o) => o.materials !== "complete")
  const since = (s: string | null) => { if (!s) return ""; const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000); return d <= 0 ? "desde hoy" : `hace ${d} d` }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center gap-2"><Heading level="h2">Bloqueos activos</Heading><Badge size="2xsmall" color={blocked.length ? "red" : "green"}>{blocked.length}</Badge></div>
        {blocked.length === 0 && <Text size="small" className="text-ui-fg-subtle">Sin bloqueos activos.</Text>}
        <div className="flex flex-col gap-2">
          {blocked.map((o) => (
            <button key={o.id} type="button" onClick={() => navigate(`/taller/${o.id}`)} className="rounded-lg border border-ui-border-base p-3 text-left hover:bg-ui-bg-base-hover">
              <div className="flex justify-between gap-2"><Text size="small" weight="plus">{o.number} · {o.title}</Text><Text size="xsmall" className="shrink-0 text-ui-fg-muted">{since(o.blocked_since)}</Text></div>
              <Text size="small" className="text-ui-fg-error">{o.blocker || "Sin causa indicada"}</Text>
              {o.next_action && <Text size="xsmall" className="text-ui-fg-subtle">Siguiente: {o.next_action}</Text>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2"><Heading level="h2">Materiales incompletos</Heading><Badge size="2xsmall" color={materials.length ? "orange" : "green"}>{materials.length}</Badge></div>
        {materials.length === 0 && <Text size="small" className="text-ui-fg-subtle">Todas las órdenes abiertas tienen sus materiales.</Text>}
        <div className="flex flex-col gap-2">
          {materials.map((o) => (
            <button key={o.id} type="button" onClick={() => navigate(`/taller/${o.id}`)} className="flex items-start justify-between gap-3 rounded-lg border border-ui-border-base p-3 text-left hover:bg-ui-bg-base-hover">
              <div><Text size="small" weight="plus">{o.number} · {o.title}</Text>{o.materials_note && <Text size="xsmall" className="text-ui-fg-subtle">Falta: {o.materials_note}</Text>}<Text size="xsmall" className="text-ui-fg-muted">Entrega {fmtDay(o.due_date)}</Text></div>
              <Badge size="2xsmall" color={materialsColor(o.materials)}>{MATERIALS_LABEL[o.materials]}</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Page ─── */

const WorkshopPage = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (["plan", "orders", "blocks"].includes(params.get("tab") || "") ? params.get("tab") : "plan") as Tab
  const mode = (["week", "load", "timeline"].includes(params.get("vista") || "") ? params.get("vista") : "week") as Mode
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(params.get("semana") || "") ? mondayOf(params.get("semana") as string) : mondayOf(today())
  const set = (patch: Record<string, string | null>) => { const p = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v === null) p.delete(k); else p.set(k, v) } setParams(p, { replace: true }) }

  const [selection] = useCompany()
  const company = selection === "all" ? undefined : selection
  const [summary, setSummary] = useState<Summary | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [person, setPerson] = useState("")
  const [editing, setEditing] = useState<Activity | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)

  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(monday, i)), [monday])
  useEffect(() => { getSummary(company).then(setSummary).catch(() => setSummary(null)) }, [company, tick])
  useEffect(() => { listResources().then(({ resources }) => setResources(resources)).catch(() => {}) }, [tick])
  const loadSchedule = useCallback(() => getSchedule(days[0], days[days.length - 1], company).then(setSchedule).catch((e) => toast.error(errorMessage(e, "No se pudo cargar el planificador"))), [days, company])
  useEffect(() => { if (tab === "plan") loadSchedule() }, [tab, loadSchedule, tick])

  const move = async (id: string, date: string | null) => {
    if (!schedule) return
    const current = [...schedule.activities, ...schedule.unscheduled].find((a) => a.id === id)
    if (!current || current.date === date) return
    // Optimistic: move the card right away, then confirm with the server.
    const moved = { ...current, date }
    setSchedule({ ...schedule, activities: [...schedule.activities.filter((a) => a.id !== id), ...(date ? [moved] : [])], unscheduled: [...schedule.unscheduled.filter((a) => a.id !== id), ...(date ? [] : [moved])] })
    try { const { warnings } = await updateActivity(id, { date }); warnings.forEach((w) => toast.warning(w)) } catch (e) { toast.error(errorMessage(e, "No se pudo mover")) }
    refresh()
  }

  // New order
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<OrderInput>(emptyOrder(defaultCompanyCode(selection)))
  const [acts, setActs] = useState<ActivityInput[]>([])
  const [busy, setBusy] = useState(false)
  const startNew = () => { setDraft(emptyOrder(defaultCompanyCode(selection))); setActs(ACTIVITY_TEMPLATES.fabrication.map((a) => ({ ...a, date: null, resource_id: null }))); setOpen(true) }
  const create = async () => {
    if (!draft.title.trim()) { toast.error("Escriba el nombre del trabajo"); return }
    const clean = acts.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim(), hours: Math.max(0.25, Number(a.hours) || 1) }))
    setBusy(true)
    try { const { order } = await createOrder({ ...draft, activities: clean }); toast.success(`Orden ${order.number} creada`); setOpen(false); navigate(`/taller/${order.id}`) } catch (e) { toast.error(errorMessage(e, "No se pudo crear")) } finally { setBusy(false) }
  }

  const editingOrder = editing ? schedule?.orders.find((o) => o.id === editing.order_id) : null

  return (
    <div className="flex flex-col gap-3">
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Heading level="h1">Taller</Heading>
            <Text size="small" className="text-ui-fg-subtle">Órdenes de fabricación, reparación y mantenimiento, planificadas por día y por persona.</Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CompanySwitcher compact />
            <Button size="small" variant="secondary" onClick={() => navigate("/taller/recursos")}>Recursos</Button>
            <Button size="small" onClick={startNew}>Nueva orden</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 py-4 lg:grid-cols-4">
          <Metric label="Órdenes abiertas" value={summary?.open ?? "—"} hint="Fabricación y servicios" />
          <Metric label="Bloqueos activos" value={summary?.blocked ?? "—"} hint="Requieren resolución" tone={summary?.blocked ? "warn" : undefined} />
          <Metric label="Entregas esta semana" value={summary?.due_this_week ?? "—"} hint={summary?.overdue ? `${summary.overdue} atrasada${summary.overdue === 1 ? "" : "s"}` : "Hasta el domingo"} tone={summary?.overdue ? "danger" : undefined} />
          <Metric label="En inspección" value={summary?.inspection ?? "—"} hint="Pendientes de liberar" />
        </div>
        <div className="flex flex-wrap gap-1 px-6 py-3">
          {([["plan", "Planificador"], ["orders", "Órdenes de trabajo"], ["blocks", "Bloqueos y materiales"]] as [Tab, string][]).map(([k, l]) => <Button key={k} size="small" variant={tab === k ? "primary" : "transparent"} onClick={() => set({ tab: k === "plan" ? null : k })}>{l}</Button>)}
        </div>
      </Container>

      <Container className="p-4 md:p-6">
        {tab === "plan" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-lg border border-ui-border-base p-0.5">
                {([["week", "Semana"], ["load", "Carga"], ["timeline", "Cronograma"]] as [Mode, string][]).map(([k, l]) => <Button key={k} size="small" variant={mode === k ? "secondary" : "transparent"} onClick={() => set({ vista: k === "week" ? null : k })}>{l}</Button>)}
              </div>
              <div className="flex items-center gap-1">
                <Button size="small" variant="transparent" onClick={() => set({ semana: addDays(monday, mode === "timeline" ? -28 : -7) })} aria-label="Semana anterior">←</Button>
                <Text size="small" weight="plus" className="min-w-[150px] text-center">{mode === "timeline" ? `${dayShort(monday)} – ${dayShort(addDays(monday, 26))}` : weekLabel(monday)}</Text>
                <Button size="small" variant="transparent" onClick={() => set({ semana: addDays(monday, mode === "timeline" ? 28 : 7) })} aria-label="Semana siguiente">→</Button>
                {monday !== mondayOf(today()) && <Button size="small" variant="secondary" onClick={() => set({ semana: null })}>Hoy</Button>}
              </div>
              <span className="flex-1" />
              {mode !== "timeline" && <Button size="small" variant="secondary" asChild><a href={weekPdfUrl(monday, company)} target="_blank" rel="noreferrer">Imprimir semana</a></Button>}
              {mode === "week" && (
                <div className="w-52">
                  <Select size="small" value={person || "all"} onValueChange={(v) => setPerson(v === "all" ? "" : v)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="all">Todas las personas</Select.Item>
                      {resources.filter((r) => r.active).map((r) => <Select.Item key={r.id} value={r.id}>{r.name}</Select.Item>)}
                      <Select.Item value="none">Sin asignar</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              )}
            </div>
            {mode === "timeline" ? <Timeline from={monday} company={company} onOpenOrder={(id) => navigate(`/taller/${id}`)} />
              : !schedule ? <Text size="small" className="text-ui-fg-subtle">Cargando…</Text>
              : mode === "week" ? <WeekBoard data={schedule} days={days} person={person} onOpen={setEditing} onMove={move} />
              : <LoadView data={schedule} days={days} />}
          </div>
        )}
        {tab === "orders" && <OrdersTable company={company} resources={resources} tick={tick} />}
        {tab === "blocks" && <BlocksView company={company} tick={tick} />}
      </Container>

      <ActivityDrawer activity={editing} order={editingOrder} resources={resources} onClose={() => setEditing(null)} onSaved={refresh} />

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="small" onClick={create} isLoading={busy}>Crear orden</Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
              <div>
                <FocusModal.Title asChild><Heading level="h1">Nueva orden de trabajo</Heading></FocusModal.Title>
                <Text size="small" className="text-ui-fg-subtle">Se crea en Preparación con la lista de inspección del tipo de trabajo.</Text>
              </div>
              <WorkOrderForm value={draft} onChange={setDraft} resources={resources} creating activities={acts} onActivities={setActs} />
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Taller", icon: Tools })

export default WorkshopPage
