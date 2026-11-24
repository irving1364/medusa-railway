import React from "react"

type Loose = Record<string, any>
type PdfLib = typeof import("@react-pdf/renderer", { with: { "resolution-mode": "import" } })

let libPromise: Promise<PdfLib> | null = null
const loadLib = () => (libPromise ||= import("@react-pdf/renderer").then((lib) => { registerFonts(lib); return lib }))
const registerFonts = ({ Font }: PdfLib) => {
  Font.register({ family: "Montserrat", fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-italic.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-600-normal.ttf", fontWeight: 600 },
  ] })
  Font.registerHyphenationCallback((word) => [word])
}

const DEFAULT_ACCENT = "#0E6B78", INK = "#1F2430", MUTED = "#5C6370", LINE = "#C9D0DA", SOFT = "#F3F5F7", RED = "#AD4B40"

const TYPE: Loose = { fabrication: "Fabricación", repair: "Reparación", maintenance: "Mantenimiento" }
const STAGE: Loose = { preparation: "Preparación", scheduled: "Programado", in_progress: "En proceso", inspection: "En inspección", released: "Liberado", delivered: "Entregado", closed: "Cerrado", cancelled: "Cancelado" }
const PRIORITY: Loose = { low: "Baja", normal: "Normal", high: "Alta", urgent: "URGENTE" }
const ACT: Loose = { pending: "Pendiente", in_progress: "En proceso", done: "Hecho" }
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

const day = (s: string | null | undefined) => (s ? s.split("-").reverse().join("/") : "—")
const dayDate = (s: string) => new Date(`${s}T12:00:00Z`)
const dayLong = (s: string) => { const d = dayDate(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}` }
const addDays = (s: string, n: number) => { const d = dayDate(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
/** Now in Panama (UTC-5), for "Impreso el …". */
const printedAt = () => { const t = new Date(Date.now() - 5 * 3600000); const p = (n: number) => String(n).padStart(2, "0"); return `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}` }
const qty = (n: unknown) => { const v = Math.round((Number(n) || 0) * 1000) / 1000; return v.toLocaleString("es-PA", { maximumFractionDigits: 3 }) }
const hrs = (n: unknown) => `${qty(n)} h`
const unitShort = (u: string | null | undefined) => (/^unidad(es)?$/i.test(String(u || "").trim()) ? "Ud." : String(u || ""))
const textLines = (t: string | null | undefined) => (t || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
const accentOf = (identity: Loose) => (/^#[0-9a-f]{6}$/i.test(String(identity.color || "")) ? String(identity.color) : DEFAULT_ACCENT)

const makeStyles = ({ StyleSheet }: PdfLib, A: string) => StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 54, paddingHorizontal: 32, fontFamily: "Montserrat", fontSize: 8.5, color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: A, paddingBottom: 10, marginBottom: 12 },
  brand: { fontSize: 11, fontWeight: 600, color: A },
  small: { fontSize: 7.5, color: MUTED },
  logo: { width: 96, height: 34, objectFit: "contain", objectPosition: "right" },
  docTitle: { fontSize: 9, color: MUTED, textAlign: "right" },
  number: { fontSize: 20, fontWeight: 600, color: A, textAlign: "right" },
  h1: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: LINE, borderRadius: 4, marginBottom: 10 },
  cell: { width: "25%", paddingVertical: 5, paddingHorizontal: 7, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  label: { fontSize: 7, color: MUTED, marginBottom: 1 },
  value: { fontSize: 9 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 9.5, fontWeight: 600, color: A, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  p: { fontSize: 8.5, lineHeight: 1.4 },
  alert: { borderWidth: 1, borderColor: RED, borderRadius: 4, padding: 7, marginBottom: 10, color: RED },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: A, color: "#FFFFFF", fontSize: 7.5, fontWeight: 600 },
  th: { paddingVertical: 5, paddingHorizontal: 5 },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, minHeight: 19, alignItems: "center" },
  td: { paddingVertical: 4, paddingHorizontal: 5 },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: INK, borderRadius: 1.5, alignItems: "center", justifyContent: "center" },
  boxOn: { width: 6, height: 6, backgroundColor: INK },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  signs: { flexDirection: "row", gap: 10, marginTop: 5 },
  sign: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 5, height: 34 },
  ruled: { borderBottomWidth: 1, borderBottomColor: LINE, height: 16 },
  footer: { position: "absolute", left: 32, right: 32, bottom: 22, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 5, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED },
  // weekly program
  wHead: { flexDirection: "row", backgroundColor: A, color: "#FFFFFF", fontWeight: 600, fontSize: 8 },
  wPerson: { width: 92, padding: 5, borderRightWidth: 1, borderRightColor: LINE },
  wDay: { flex: 1, padding: 4, borderRightWidth: 1, borderRightColor: LINE },
  wRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  chip: { borderLeftWidth: 2.5, borderLeftColor: A, backgroundColor: SOFT, borderRadius: 2, paddingVertical: 2.5, paddingHorizontal: 4, marginBottom: 3 },
  chipTitle: { fontSize: 7.5, fontWeight: 600 },
  chipSub: { fontSize: 6.8, color: MUTED },
})

const build = (lib: PdfLib, accent: string) => {
  const { Document, Image, Page, Text, View } = lib
  const s = makeStyles(lib, accent)

  const Box = ({ on }: { on?: boolean }) => <View style={s.box}>{on ? <View style={s.boxOn} /> : null}</View>
  const Header = ({ identity, title, number, sub }: { identity: Loose; title: string; number: string; sub?: string }) => (
    <View style={s.header} fixed>
      <View style={{ maxWidth: "55%" }}>
        {identity.logo_url ? <Image src={identity.logo_url} style={[s.logo, { objectPosition: "left" }]} /> : <Text style={s.brand}>{identity.brand_line || identity.name}</Text>}
        {identity.logo_url ? <Text style={[s.small, { marginTop: 3 }]}>{identity.brand_line || identity.name}</Text> : null}
      </View>
      <View>
        <Text style={s.docTitle}>{title}</Text>
        <Text style={s.number}>{number}</Text>
        {sub ? <Text style={[s.small, { textAlign: "right" }]}>{sub}</Text> : null}
      </View>
    </View>
  )
  const Footer = ({ left }: { left: string }) => (
    <View style={s.footer} fixed>
      <Text>{left}</Text>
      <Text>Impreso el {printedAt()}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
    </View>
  )
  const Cell = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
    <View style={[s.cell, wide ? { width: "50%" } : {}]}><Text style={s.label}>{label}</Text><Text style={s.value}>{children}</Text></View>
  )

  /** Work order for the shop floor: data, operations with space for real hours and initials, materials, inspection, delivery. */
  const WorkOrderDocument = ({ order, identity, people }: { order: Loose; identity: Loose; people: Map<string, string> }) => {
    const o = order
    const acts = (o.activities || []) as Loose[]
    const mats = (o.material_lines || []) as Loose[]
    const checks = (o.checklist || []) as Loose[]
    const person = (id: string | null) => (id && people.get(id)) || ""
    const title = o.type === "fabrication" ? "ORDEN DE PRODUCCIÓN" : "ORDEN DE TRABAJO"
    const C = { n: { width: "5%" }, op: { width: "33%" }, who: { width: "16%" }, date: { width: "12%" }, plan: { width: "9%", textAlign: "right" as const }, real: { width: "10%" }, ok: { width: "15%" } }
    const M = { name: { width: "48%" }, need: { width: "14%", textAlign: "right" as const }, used: { width: "14%", textAlign: "right" as const }, took: { width: "24%" } }
    return (
      <Document title={`${o.number} · ${o.title}`} author={identity.legal_name || identity.name} subject={o.client_name || ""}>
        <Page size="A4" style={s.page}>
          <Header identity={identity} title={title} number={o.number} sub={`${TYPE[o.type]} · ${STAGE[o.stage]}`} />
          <Text style={s.h1}>{o.title}{Number(o.quantity) > 1 ? `  ×${qty(o.quantity)}` : ""}</Text>
          {o.blocked ? <View style={s.alert}><Text style={{ fontWeight: 600 }}>BLOQUEADA</Text><Text>{o.blocker || "Sin causa indicada"}</Text></View> : null}

          <View style={s.grid}>
            <Cell label="Cliente" wide>{o.client_name || "—"}</Cell>
            <Cell label="Cotización">{o.quote_number || "—"}</Cell>
            <Cell label="Prioridad">{PRIORITY[o.priority] || o.priority}</Cell>
            <Cell label="Entrega comprometida">{day(o.due_date)}</Cell>
            <Cell label="Terminación interna">{day(o.finish_date)}</Cell>
            <Cell label="Responsable">{person(o.owner_id) || "—"}</Cell>
            <Cell label="Horas previstas">{hrs(acts.reduce((t, a) => t + (Number(a.hours) || 0), 0))}</Cell>
          </View>

          {o.description ? <View style={s.section} wrap={false}><Text style={s.sectionTitle}>Descripción y especificaciones</Text>{textLines(o.description).map((t, i) => <Text key={i} style={s.p}>{t}</Text>)}</View> : null}
          {o.next_action ? <View style={s.section} wrap={false}><Text style={s.sectionTitle}>Siguiente acción</Text><Text style={s.p}>{o.next_action}</Text></View> : null}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Operaciones</Text>
            <View style={s.table}>
              <View style={s.thead}>
                <Text style={[s.th, C.n]}>#</Text><Text style={[s.th, C.op]}>OPERACIÓN</Text><Text style={[s.th, C.who]}>RESPONSABLE</Text><Text style={[s.th, C.date]}>FECHA</Text>
                <Text style={[s.th, C.plan]}>PREV.</Text><Text style={[s.th, C.real]}>REALES</Text><Text style={[s.th, C.ok]}>HECHO / FIRMA</Text>
              </View>
              {acts.length === 0 ? <View style={s.row}><Text style={[s.td, { color: MUTED }]}>Sin operaciones registradas.</Text></View> : null}
              {acts.map((a, i) => (
                <View key={a.id} style={s.row} wrap={false}>
                  <Text style={[s.td, C.n]}>{i + 1}</Text>
                  <View style={[s.td, C.op]}><Text>{a.name}</Text>{a.notes ? <Text style={s.small}>{a.notes}</Text> : null}</View>
                  <Text style={[s.td, C.who]}>{person(a.resource_id)}</Text>
                  <Text style={[s.td, C.date]}>{a.date ? day(a.date) : ""}</Text>
                  <Text style={[s.td, C.plan]}>{hrs(a.hours)}</Text>
                  <Text style={[s.td, C.real]}>{a.actual_hours !== null && a.actual_hours !== undefined ? hrs(a.actual_hours) : ""}</Text>
                  <View style={[s.td, C.ok, { flexDirection: "row", alignItems: "center", gap: 5 }]}><Box on={a.status === "done"} /><Text style={s.small}>{a.status === "done" ? ACT.done : ""}</Text></View>
                </View>
              ))}
            </View>
          </View>

          {mats.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Materiales</Text>
              <View style={s.table}>
                <View style={s.thead}>
                  <Text style={[s.th, M.name]}>MATERIAL</Text><Text style={[s.th, M.need]}>NECESARIO</Text><Text style={[s.th, M.used]}>CONSUMIDO</Text><Text style={[s.th, M.took]}>RETIRADO DE BODEGA</Text>
                </View>
                {mats.map((m) => (
                  <View key={m.id} style={s.row} wrap={false}>
                    <Text style={[s.td, M.name]}>{m.item_ref ? `[${m.item_ref}] ` : ""}{m.name}</Text>
                    <Text style={[s.td, M.need]}>{qty(m.required)} {unitShort(m.unit)}</Text>
                    <Text style={[s.td, M.used]}>{Number(m.consumed) ? qty(m.consumed) : ""}</Text>
                    <View style={[s.td, M.took, { flexDirection: "row", alignItems: "center", gap: 5 }]}><Box on={Number(m.consumed) >= Number(m.required)} /><Text style={s.small}>{m.shortfall > 0 ? `Falta comprar ${qty(m.shortfall)}` : ""}</Text></View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Inspección de calidad</Text>
            {checks.map((c, i) => <View key={i} style={s.checkRow}><Box on={!!c.done} /><Text>{c.label}</Text></View>)}
            <View style={s.signs}>
              <View style={s.sign}><Text style={s.label}>Inspeccionado por</Text><Text>{o.inspected_by || ""}</Text></View>
              <View style={s.sign}><Text style={s.label}>Fecha</Text><Text>{o.released_at ? day(new Date(o.released_at).toISOString().slice(0, 10)) : ""}</Text></View>
              <View style={s.sign}><Text style={s.label}>Firma</Text></View>
            </View>
          </View>

          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Entrega</Text>
            {o.delivery_note ? <Text style={[s.p, { marginBottom: 4 }]}>{o.delivery_note}</Text> : null}
            <View style={s.signs}>
              <View style={s.sign}><Text style={s.label}>Recibido por (nombre)</Text></View>
              <View style={s.sign}><Text style={s.label}>Fecha</Text><Text>{o.delivered_at ? day(new Date(o.delivered_at).toISOString().slice(0, 10)) : ""}</Text></View>
              <View style={s.sign}><Text style={s.label}>Firma y sello</Text></View>
            </View>
          </View>

          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>Observaciones del taller</Text>
            {[0, 1, 2].map((i) => <View key={i} style={s.ruled} />)}
          </View>

          <Footer left={`${o.number} · ${o.title}`} />
        </Page>
      </Document>
    )
  }

  /** Weekly program for the wall: one row per person, one column per day (Mon–Sat), plus deliveries of the week. */
  const WeekDocument = ({ from, data, identity, companyLabel }: { from: string; data: Loose; identity: Loose; companyLabel: string }) => {
    const days = Array.from({ length: 6 }, (_, i) => addDays(from, i))
    const orders = new Map<string, Loose>((data.orders || []).map((o: Loose) => [o.id, o]))
    const acts = (data.activities || []) as Loose[]
    const people = ((data.resources || []) as Loose[]).filter((r) => (r.active && !r.deleted_at) || acts.some((a) => a.resource_id === r.id))
    const rows: { id: string | null; name: string; role: string; cap: number }[] = [
      ...people.map((r) => ({ id: r.id as string, name: r.name as string, role: (r.role || "") as string, cap: Number(r.daily_capacity) || 0 })),
      ...(acts.some((a) => !a.resource_id) ? [{ id: null, name: "Sin asignar", role: "", cap: 0 }] : []),
    ]
    const sat = days[5], a = dayDate(from), b = dayDate(sat)
    const range = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} al ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]} de ${b.getUTCFullYear()}` : `${a.getUTCDate()} de ${MONTHS[a.getUTCMonth()]} al ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]} de ${b.getUTCFullYear()}`
    const due = (data.orders || []).filter((o: Loose) => o.due_date && o.due_date >= from && o.due_date <= addDays(from, 6)).sort((x: Loose, y: Loose) => String(x.due_date).localeCompare(String(y.due_date)))
    const blocked = (data.orders || []).filter((o: Loose) => o.blocked && ["preparation", "scheduled", "in_progress", "inspection"].includes(o.stage))
    const unscheduled = (data.unscheduled || []).length
    return (
      <Document title={`Programa del taller · ${range}`} author={identity.legal_name || identity.name}>
        <Page size="A4" orientation="landscape" style={s.page}>
          <Header identity={identity} title="PROGRAMA SEMANAL DEL TALLER" number={`Semana del ${day(from)}`} sub={`${range}${companyLabel ? ` · ${companyLabel}` : ""}`} />
          <View style={s.table}>
            <View style={s.wHead} fixed>
              <Text style={s.wPerson}>PERSONA</Text>
              {days.map((d) => <Text key={d} style={s.wDay}>{dayLong(d).toUpperCase()}</Text>)}
            </View>
            {rows.length === 0 ? <View style={s.wRow}><Text style={{ padding: 6, color: MUTED }}>Sin personas registradas en Recursos.</Text></View> : null}
            {rows.map((r) => (
              <View key={r.id || "none"} style={s.wRow} wrap={false}>
                <View style={s.wPerson}><Text style={{ fontWeight: 600 }}>{r.name}</Text>{r.role ? <Text style={s.chipSub}>{r.role}</Text> : null}</View>
                {days.map((d) => {
                  const list = acts.filter((x) => x.date === d && (x.resource_id || null) === r.id)
                  const load = list.filter((x) => x.status !== "done").reduce((t, x) => t + (Number(x.hours) || 0), 0)
                  return (
                    <View key={d} style={[s.wDay, { minHeight: 40 }]}>
                      {list.map((x) => {
                        const o = orders.get(x.order_id) || {}
                        return (
                          <View key={x.id} style={[s.chip, o.blocked ? { borderLeftColor: RED } : {}, x.status === "done" ? { opacity: 0.55 } : {}]}>
                            <Text style={s.chipTitle}>{x.name}</Text>
                            <Text style={s.chipSub}>{o.number || ""} · {hrs(x.hours)}{x.status === "done" ? " · hecho" : ""}{o.blocked ? " · BLOQUEADA" : ""}</Text>
                            {o.title ? <Text style={s.chipSub}>{String(o.title).slice(0, 48)}</Text> : null}
                          </View>
                        )
                      })}
                      {r.cap > 0 && load > r.cap ? <Text style={{ fontSize: 6.8, color: RED }}>{hrs(load)} · supera {hrs(r.cap)}</Text> : null}
                    </View>
                  )
                })}
              </View>
            ))}
            <View style={[s.wRow, { backgroundColor: SOFT }]}>
              <Text style={[s.wPerson, { fontWeight: 600 }]}>Horas pendientes</Text>
              {days.map((d) => <Text key={d} style={[s.wDay, { fontWeight: 600 }]}>{hrs(acts.filter((x) => x.date === d && x.status !== "done").reduce((t, x) => t + (Number(x.hours) || 0), 0))}</Text>)}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 14, marginTop: 10 }} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Entregas de la semana</Text>
              {due.length === 0 ? <Text style={s.small}>Ninguna.</Text> : due.map((o: Loose) => <Text key={o.id} style={s.p}>{day(o.due_date)} · <Text style={{ fontWeight: 600 }}>{o.number}</Text> {o.title}{o.client_name ? ` · ${o.client_name}` : ""} ({STAGE[o.stage]})</Text>)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Bloqueos activos</Text>
              {blocked.length === 0 ? <Text style={s.small}>Ninguno.</Text> : blocked.map((o: Loose) => <Text key={o.id} style={[s.p, { color: RED }]}><Text style={{ fontWeight: 600 }}>{o.number}</Text> {o.blocker || "sin causa indicada"}</Text>)}
              {unscheduled > 0 ? <Text style={[s.small, { marginTop: 6 }]}>Quedan {unscheduled} actividad{unscheduled === 1 ? "" : "es"} sin fecha (no aparecen en esta hoja).</Text> : null}
            </View>
          </View>
          <Footer left={`Programa del taller · semana del ${day(from)}`} />
        </Page>
      </Document>
    )
  }

  return { WorkOrderDocument, WeekDocument }
}

export const renderWorkOrderPdf = async (order: Loose, identity: Loose, people: Map<string, string>): Promise<Buffer> => {
  const lib = await loadLib()
  const { WorkOrderDocument } = build(lib, accentOf(identity))
  return lib.renderToBuffer(<WorkOrderDocument order={order} identity={identity} people={people} />)
}

export const renderWeekPdf = async (from: string, data: Loose, identity: Loose, companyLabel: string): Promise<Buffer> => {
  const lib = await loadLib()
  const { WeekDocument } = build(lib, accentOf(identity))
  return lib.renderToBuffer(<WeekDocument from={from} data={data} identity={identity} companyLabel={companyLabel} />)
}
