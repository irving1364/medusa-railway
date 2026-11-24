import { ArrowLeft } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Input, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import CompanySwitcher from "../../../components/company-switcher"
import { useCompany } from "../../../lib/companies"
import { STAGE_LABEL, TYPE_LABEL, addDays, dayShort, downloadCsv, errorMessage, fmtDay, getReports, iso, parseDay, today, type Reports } from "../../../lib/workshop"

const money = (n: number) => `${n.toLocaleString("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} B/.`
const qty = (n: number) => n.toLocaleString("es-PA", { maximumFractionDigits: 2 })
const signed = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n}%`)

/** Preset periods; the URL keeps the chosen range so a report can be shared. */
const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "month", label: "Este mes", range: () => { const t = parseDay(today()); return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), today()] } },
  { key: "prev", label: "Mes anterior", range: () => { const t = parseDay(today()); return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))] } },
  { key: "90", label: "Últimos 90 días", range: () => [addDays(today(), -89), today()] },
  { key: "year", label: "Este año", range: () => [`${today().slice(0, 4)}-01-01`, today()] },
]

const Kpi = ({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" | "danger" | "good" }) => (
  <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <Text size="xsmall" className="text-ui-fg-subtle">{label}</Text>
    <Text className={`mt-1.5 text-2xl font-semibold ${tone === "danger" ? "text-ui-fg-error" : tone === "warn" ? "text-ui-tag-orange-text" : tone === "good" ? "text-ui-tag-green-text" : "text-ui-fg-base"}`}>{value}</Text>
    {hint && <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text>}
  </div>
)

const Section = ({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) => (
  <Container className="flex flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><Heading level="h2">{title}</Heading>{hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}</div>
      {action}
    </div>
    {children}
  </Container>
)

const Empty = ({ children }: { children: ReactNode }) => <Text size="small" className="text-ui-fg-subtle">{children}</Text>

/**
 * Deliveries per week: one series (count) in one hue, 4px rounded tops on a shared baseline,
 * recessive grid, hover tooltip with the on-time / late split. The list below is the table view.
 */
function WeeksChart({ weeks }: { weeks: Reports["weeks"] }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = (w: Reports["weeks"][number]) => w.on_time + w.late + w.no_date
  const max = Math.max(1, ...weeks.map(total))
  const step = max <= 4 ? 1 : Math.ceil(max / 4)
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
  const top = ticks[ticks.length - 1] || 1
  const labelEvery = Math.ceil(weeks.length / 12)
  if (!weeks.some(total)) return <Empty>No hubo entregas en el periodo.</Empty>
  return (
    <div className="relative">
      <div className="flex h-48 gap-2">
        <div className="flex w-6 flex-col-reverse justify-between text-right">{ticks.map((t) => <Text key={t} size="xsmall" className="leading-none text-ui-fg-muted">{t}</Text>)}</div>
        <div className="relative flex-1">
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-ui-border-base" style={{ bottom: `${(t / top) * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {weeks.map((w, i) => {
              const v = total(w)
              return (
                <div key={w.week} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {v > 0 && <div className={`w-full rounded-t-[4px] bg-ui-fg-interactive transition-opacity ${hover !== null && hover !== i ? "opacity-50" : ""}`} style={{ height: `${(v / top) * 100}%`, minHeight: 2 }} />}
                  {hover === i && (
                    <div className={`pointer-events-none absolute bottom-full z-10 mb-2 w-44 rounded-md ${i < weeks.length / 3 ? "left-0" : i > (weeks.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2"} border border-ui-border-base bg-ui-bg-base p-2 shadow-elevation-flyout`}>
                      <Text size="xsmall" weight="plus">Semana del {dayShort(w.week)}</Text>
                      <Text size="xsmall">{v} entrega{v === 1 ? "" : "s"}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">A tiempo: {w.on_time} · Con atraso: {w.late}{w.no_date ? ` · Sin fecha: ${w.no_date}` : ""}</Text>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ml-8 mt-1 flex gap-[2px]">
        {weeks.map((w, i) => <Text key={w.week} size="xsmall" className="flex-1 truncate text-center text-ui-fg-muted">{i % labelEvery === 0 ? dayShort(w.week) : ""}</Text>)}
      </div>
    </div>
  )
}

/** Single-hue horizontal meter for a share (utilisation): neutral track, value text beside it. */
const Meter = ({ pct }: { pct: number | null }) => (
  <div className="flex items-center gap-2">
    <div className="h-2 w-24 overflow-hidden rounded-full bg-ui-bg-component"><div className="h-full rounded-full bg-ui-fg-interactive" style={{ width: `${Math.min(100, pct || 0)}%` }} /></div>
    <Text size="xsmall" className={pct !== null && pct > 100 ? "font-semibold text-ui-fg-error" : ""}>{pct === null ? "—" : `${pct}%`}</Text>
  </div>
)

/** /taller/reportes — on-time delivery, lead time, hours, people, rework, blockers and materials for a period. */
const WorkshopReportsPage = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [selection] = useCompany()
  const company = selection === "all" ? undefined : selection
  const valid = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  const [defFrom, defTo] = PRESETS[2].range()
  const from = valid(params.get("desde")) ? (params.get("desde") as string) : defFrom
  const to = valid(params.get("hasta")) ? (params.get("hasta") as string) : defTo
  const setRange = (f: string, t: string) => { const p = new URLSearchParams(params); p.set("desde", f); p.set("hasta", t); setParams(p, { replace: true }) }
  const [data, setData] = useState<Reports | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (from > to) return
    setLoading(true)
    getReports(from, to, company).then(setData).catch((e) => toast.error(errorMessage(e, "No se pudo calcular el reporte"))).finally(() => setLoading(false))
  }, [from, to, company])

  const preset = useMemo(() => PRESETS.find((p) => { const [f, t] = p.range(); return f === from && t === to })?.key, [from, to])
  const s = data?.summary
  const exportDeliveries = () => data && downloadCsv(`entregas-${from}-a-${to}.csv`,
    ["Orden", "Tipo", "Trabajo", "Cliente", "Entrega comprometida", "Entregada", "Días de atraso", "Días desde la orden", "Fecha movida"],
    data.delivered.map((d) => [d.number, TYPE_LABEL[d.type], d.title, d.client_name, fmtDay(d.due), fmtDay(d.delivered), d.late_days, d.lead_days, d.moved ? "Sí" : "No"]))
  const exportHours = () => data && downloadCsv(`horas-por-operacion-${from}-a-${to}.csv`,
    ["Operación", "Actividades", "Horas previstas", "Con horas reales", "Previstas (medidas)", "Reales", "Desviación %"],
    data.operations.map((o) => [o.name, o.count, o.planned, o.measured, o.planned_measured, o.actual, o.deviation_pct]))

  return (
    <div className="flex flex-col gap-3">
      <Container className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IconButton size="small" variant="transparent" onClick={() => navigate("/taller")} aria-label="Volver"><ArrowLeft /></IconButton>
            <div>
              <Heading level="h1">Reportes del taller</Heading>
              <Text size="small" className="text-ui-fg-subtle">Entregas a tiempo, tiempos, horas, retrabajos, bloqueos y materiales del periodo.</Text>
            </div>
          </div>
          <CompanySwitcher compact />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">{PRESETS.map((p) => <Button key={p.key} size="small" variant={preset === p.key ? "primary" : "transparent"} onClick={() => setRange(...p.range())}>{p.label}</Button>)}</div>
          <div className="flex items-center gap-1.5">
            <Input size="small" type="date" value={from} max={to} onChange={(e) => e.target.value && setRange(e.target.value, to)} aria-label="Desde" />
            <Text size="small" className="text-ui-fg-subtle">a</Text>
            <Input size="small" type="date" value={to} min={from} onChange={(e) => e.target.value && setRange(from, e.target.value)} aria-label="Hasta" />
          </div>
          {loading && <Text size="xsmall" className="text-ui-fg-muted">Calculando…</Text>}
        </div>
      </Container>

      {s && data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Entregas a tiempo" value={s.on_time_pct === null ? "—" : `${s.on_time_pct}%`} tone={s.on_time_pct === null ? undefined : s.on_time_pct >= 90 ? "good" : s.on_time_pct >= 70 ? "warn" : "danger"}
              hint={s.with_due ? `${s.on_time} de ${s.with_due} con fecha comprometida${s.avg_late_days ? ` · atraso medio ${s.avg_late_days} d` : ""}` : "Sin entregas con fecha comprometida"} />
            <Kpi label="Órdenes entregadas" value={s.delivered} hint={`Fabricación ${s.delivered_by_type.fabrication} · Reparación ${s.delivered_by_type.repair} · Mant. ${s.delivered_by_type.maintenance}`} />
            <Kpi label="Tiempo medio de entrega" value={s.avg_lead_days === null ? "—" : s.avg_lead_days < 1 ? "< 1 d" : `${s.avg_lead_days} d`} hint="Desde que se crea la orden hasta la entrega" />
            <Kpi label="Horas reales vs previstas" value={signed(s.hours_deviation_pct)} tone={s.hours_deviation_pct !== null && s.hours_deviation_pct > 15 ? "warn" : undefined}
              hint={s.measured_activities ? `${qty(s.hours_measured_actual)} h reales sobre ${qty(s.hours_measured_planned)} h previstas (${s.measured_activities} act.)` : "Registre horas reales al terminar las actividades"} />
            <Kpi label="Retrabajos" value={s.rework} tone={s.rework ? "warn" : undefined} hint="Órdenes que volvieron a producción tras inspección" />
            <Kpi label="Bloqueos nuevos" value={s.blockers_new} hint={`${s.blockers_now} activos ahora${s.avg_block_days !== null ? ` · se resuelven en ${s.avg_block_days < 1 ? "menos de 1 d" : `${s.avg_block_days} d`} de media` : ""}`} tone={s.blockers_now ? "warn" : undefined} />
            <Kpi label="Órdenes abiertas ahora" value={s.open_now} hint={s.overdue_now ? `${s.overdue_now} atrasada${s.overdue_now === 1 ? "" : "s"} · ${s.created} creadas en el periodo` : `${s.created} creadas en el periodo${s.cancelled ? ` · ${s.cancelled} canceladas` : ""}`} tone={s.overdue_now ? "danger" : undefined} />
            <Kpi label="Material consumido" value={money(s.materials_cost)} hint={s.materials_unpriced ? `${s.materials_unpriced} material${s.materials_unpriced === 1 ? "" : "es"} sin precio de referencia` : "Valorado al último precio de compra"} />
          </div>

          <Section title="Entregas por semana" hint="Pase el cursor sobre una barra para ver a tiempo y con atraso." action={data.delivered.length ? <Button size="small" variant="secondary" onClick={exportDeliveries}>Exportar CSV</Button> : undefined}>
            <WeeksChart weeks={data.weeks} />
          </Section>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section title="Entregas con atraso" hint="Contra la primera fecha comprometida con el cliente.">
              {data.late.length === 0 ? <Empty>{s.delivered ? "Todas las entregas con fecha se hicieron a tiempo." : "Sin entregas en el periodo."}</Empty> : (
                <div className="overflow-x-auto"><Table>
                  <Table.Header><Table.Row><Table.HeaderCell>Orden</Table.HeaderCell><Table.HeaderCell>Comprometida</Table.HeaderCell><Table.HeaderCell>Entregada</Table.HeaderCell><Table.HeaderCell>Atraso</Table.HeaderCell></Table.Row></Table.Header>
                  <Table.Body>{data.late.map((d) => (
                    <Table.Row key={d.id} className="cursor-pointer" onClick={() => navigate(`/taller/${d.id}`)}>
                      <Table.Cell><Text size="small" weight="plus">{d.number}</Text><Text size="xsmall" className="max-w-[220px] truncate text-ui-fg-subtle">{d.title}</Text></Table.Cell>
                      <Table.Cell>{fmtDay(d.due)}{d.moved && <Text size="xsmall" className="text-ui-fg-muted">fecha movida después</Text>}</Table.Cell>
                      <Table.Cell>{fmtDay(d.delivered)}</Table.Cell>
                      <Table.Cell><Badge size="2xsmall" color="red">{d.late_days} d</Badge></Table.Cell>
                    </Table.Row>
                  ))}</Table.Body>
                </Table></div>
              )}
            </Section>

            <Section title="Carga por persona" hint={`Horas programadas en el periodo frente a su capacidad${data.unassigned_hours ? ` · ${qty(data.unassigned_hours)} h sin responsable` : ""}.`}>
              {data.people.length === 0 ? <Empty>Sin personas registradas.</Empty> : (
                <div className="overflow-x-auto"><Table>
                  <Table.Header><Table.Row><Table.HeaderCell>Persona</Table.HeaderCell><Table.HeaderCell>Programadas</Table.HeaderCell><Table.HeaderCell>Hechas</Table.HeaderCell><Table.HeaderCell>Reales</Table.HeaderCell><Table.HeaderCell>Ocupación</Table.HeaderCell></Table.Row></Table.Header>
                  <Table.Body>{data.people.map((p) => (
                    <Table.Row key={p.id}>
                      <Table.Cell><Text size="small" weight="plus">{p.name}</Text>{p.role && <Text size="xsmall" className="text-ui-fg-subtle">{p.role}</Text>}</Table.Cell>
                      <Table.Cell>{qty(p.planned)} h</Table.Cell><Table.Cell>{qty(p.done)} h</Table.Cell><Table.Cell>{p.actual ? `${qty(p.actual)} h` : "—"}</Table.Cell>
                      <Table.Cell><Meter pct={p.utilization} /><Text size="xsmall" className="text-ui-fg-muted">de {qty(p.capacity)} h</Text></Table.Cell>
                    </Table.Row>
                  ))}</Table.Body>
                </Table></div>
              )}
            </Section>
          </div>

          <Section title="Horas por operación" hint="La desviación compara horas reales con previstas en las actividades terminadas que tienen horas reales." action={data.operations.length ? <Button size="small" variant="secondary" onClick={exportHours}>Exportar CSV</Button> : undefined}>
            {data.operations.length === 0 ? <Empty>Sin actividades programadas en el periodo.</Empty> : (
              <div className="overflow-x-auto"><Table>
                <Table.Header><Table.Row><Table.HeaderCell>Operación</Table.HeaderCell><Table.HeaderCell>Actividades</Table.HeaderCell><Table.HeaderCell>Horas previstas</Table.HeaderCell><Table.HeaderCell>Medidas (prev. → reales)</Table.HeaderCell><Table.HeaderCell>Desviación</Table.HeaderCell></Table.Row></Table.Header>
                <Table.Body>{data.operations.map((o) => (
                  <Table.Row key={o.name}>
                    <Table.Cell><Text size="small" weight="plus">{o.name}</Text></Table.Cell>
                    <Table.Cell>{o.count}</Table.Cell>
                    <Table.Cell>{qty(o.planned)} h</Table.Cell>
                    <Table.Cell>{o.measured ? `${qty(o.planned_measured)} h → ${qty(o.actual)} h (${o.measured})` : <span className="text-ui-fg-muted">Sin horas reales</span>}</Table.Cell>
                    <Table.Cell>{o.deviation_pct === null ? "—" : <span className={o.deviation_pct > 15 ? "font-semibold text-ui-tag-orange-text" : o.deviation_pct < -15 ? "text-ui-tag-green-text" : ""}>{signed(o.deviation_pct)}{o.deviation_pct > 15 ? " · tarda más" : o.deviation_pct < -15 ? " · tarda menos" : ""}</span>}</Table.Cell>
                  </Table.Row>
                ))}</Table.Body>
              </Table></div>
            )}
          </Section>

          <div className="grid gap-3 xl:grid-cols-2">
            <Section title="Retrabajos" hint="Órdenes que volvieron a producción después de inspección, liberación o entrega.">
              {data.rework.length === 0 ? <Empty>Sin retrabajos en el periodo.</Empty> : (
                <div className="flex flex-col gap-2">{data.rework.map((r, i) => (
                  <Link key={i} to={`/taller/${r.id}`} className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base px-3 py-2 hover:bg-ui-bg-base-hover">
                    <div className="min-w-0"><Text size="small" weight="plus" className="truncate">{r.number} · {r.title}</Text><Text size="xsmall" className="text-ui-fg-subtle">{STAGE_LABEL[r.from]} → {STAGE_LABEL[r.to]}{r.actor ? ` · ${r.actor}` : ""}</Text></div>
                    <Text size="xsmall" className="shrink-0 text-ui-fg-muted">{fmtDay(r.date)}</Text>
                  </Link>
                ))}</div>
              )}
            </Section>

            <Section title="Causas de bloqueo" hint="Bloqueos registrados en el periodo, de la causa más frecuente a la menos.">
              {data.blocker_causes.length === 0 ? <Empty>Sin bloqueos en el periodo.</Empty> : (
                <div className="flex flex-col gap-2">{data.blocker_causes.map((b) => (
                  <div key={b.cause} className="flex items-center justify-between gap-3 border-b border-ui-border-base pb-2"><Text size="small">{b.cause}</Text><Badge size="2xsmall">{b.count}</Badge></div>
                ))}</div>
              )}
            </Section>
          </div>

          <Section title="Materiales consumidos" hint="Consumo neto (consumos menos devoluciones) registrado desde las órdenes de taller.">
            {data.materials.length === 0 ? <Empty>Sin consumos registrados en el periodo.</Empty> : (
              <div className="overflow-x-auto"><Table>
                <Table.Header><Table.Row><Table.HeaderCell>Material</Table.HeaderCell><Table.HeaderCell>Cantidad</Table.HeaderCell><Table.HeaderCell>Órdenes</Table.HeaderCell><Table.HeaderCell className="text-right">Valor aprox.</Table.HeaderCell></Table.Row></Table.Header>
                <Table.Body>{data.materials.map((m) => (
                  <Table.Row key={m.item_id}>
                    <Table.Cell><Text size="small">{m.ref ? <span className="mr-1 font-mono text-[11px] text-ui-fg-muted">[{m.ref}]</span> : null}{m.name}</Text></Table.Cell>
                    <Table.Cell>{qty(m.quantity)} {m.unit.toLowerCase()}</Table.Cell>
                    <Table.Cell>{m.orders}</Table.Cell>
                    <Table.Cell className="text-right">{m.cost === null ? <span className="text-ui-fg-muted">Sin precio</span> : money(m.cost)}</Table.Cell>
                  </Table.Row>
                ))}</Table.Body>
              </Table></div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

export default WorkshopReportsPage
