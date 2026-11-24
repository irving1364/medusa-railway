import { ArrowLeft, Trash } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, FocusModal, Heading, IconButton, Input, Label, Switch, Table, Text, Textarea, toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import ActivityDrawer from "../../../components/activity-drawer"
import WorkMaterials from "../../../components/work-materials"
import WorkPhotos, { PhotoUpload } from "../../../components/work-photos"
import WorkOrderForm, { ResourceSelect } from "../../../components/work-order-form"
import { companyColor, companyLabel } from "../../../lib/companies"
import {
  ACTIVITY_LABEL, MATERIALS_LABEL, OPEN_STAGES, PRIORITY_LABEL, STAGES, STAGE_LABEL, TYPE_LABEL, activityColor, addActivity, daysUntil, deleteOrder, errorMessage, fmtDateTime, fmtDay,
  getOrder, hours, listResources, orderPdfUrl, materialsColor, orderToInput, priorityColor, setStage, stageColor, updateActivity, updateOrder,
  type Activity, type CheckItem, type OrderInput, type Resource, type WorkOrder, type WorkStage,
} from "../../../lib/workshop"

const Info = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><Text size="xsmall" className="text-ui-fg-subtle">{label}</Text><div className="txt-compact-small mt-0.5">{children}</div></div>
)

/** Next natural step of the flow, offered as the main button. */
const NEXT: Partial<Record<WorkStage, { stage: WorkStage; label: string }>> = {
  preparation: { stage: "scheduled", label: "Marcar como programada" },
  scheduled: { stage: "in_progress", label: "Iniciar trabajo" },
  in_progress: { stage: "inspection", label: "Pasar a inspección" },
  inspection: { stage: "released", label: "Registrar liberación" },
  released: { stage: "delivered", label: "Registrar entrega" },
  delivered: { stage: "closed", label: "Cerrar orden" },
}

const WorkOrderPage = () => {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const prompt = usePrompt()
  const [order, setOrder] = useState<WorkOrder | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [editing, setEditing] = useState<Activity | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => getOrder(id).then(({ order }) => setOrder(order)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar la orden"))), [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { listResources().then(({ resources }) => setResources(resources)).catch(() => {}) }, [])
  const people = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources])

  // Blocker / checklist / delivery drafts follow the order
  const [blocked, setBlocked] = useState(false)
  const [blocker, setBlocker] = useState("")
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [newCheck, setNewCheck] = useState("")
  const [deliveryNote, setDeliveryNote] = useState("")
  useEffect(() => { if (order) { setBlocked(order.blocked); setBlocker(order.blocker || ""); setChecks(order.checklist); setDeliveryNote(order.delivery_note || "") } }, [order])

  const run = async (fn: () => Promise<{ order: WorkOrder }>, ok: string) => {
    setBusy(true)
    try { const { order } = await fn(); setOrder(order); toast.success(ok) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }

  // Edit modal
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<OrderInput | null>(null)
  const startEdit = () => { if (order) { setDraft(orderToInput(order)); setOpen(true) } }
  const saveEdit = async () => {
    if (!draft?.title.trim()) { toast.error("Escriba el nombre del trabajo"); return }
    const { type: _type, ...rest } = draft
    await run(() => updateOrder(id, rest), "Orden actualizada")
    setOpen(false)
  }

  // New activity row
  const [act, setAct] = useState({ name: "", resource_id: "", hours: "2", date: "" })
  const addAct = async () => {
    if (!act.name.trim()) { toast.error("Escriba la operación"); return }
    await run(() => addActivity(id, { name: act.name.trim(), resource_id: act.resource_id || null, hours: Math.max(0.25, Number(act.hours) || 1), date: act.date || null }), "Operación añadida")
    setAct({ name: "", resource_id: "", hours: "2", date: "" })
  }
  const quickStatus = async (a: Activity) => {
    const next = a.status === "pending" ? "in_progress" : a.status === "in_progress" ? "done" : "pending"
    try { const { warnings } = await updateActivity(a.id, { status: next }); warnings.forEach((w) => toast.warning(w)); load() } catch (e) { toast.error(errorMessage(e, "No se pudo actualizar")) }
  }

  const changeStage = async (stage: WorkStage) => {
    if (!order) return
    if (stage === "cancelled" && !(await prompt({ title: "Cancelar orden", description: "La orden deja de aparecer en el planificador. Puede reabrirse después en Preparación.", confirmText: "Cancelar orden", cancelText: "Volver" }))) return
    await run(() => setStage(id, stage, stage === "delivered" ? deliveryNote.trim() : undefined), `Estado: ${STAGE_LABEL[stage]}`)
  }
  const remove = async () => {
    if (!order) return
    if (!(await prompt({ title: `Eliminar ${order.number}`, description: "Se elimina la orden con sus operaciones. El número no se reutiliza. Para un trabajo que no se hará, es mejor cancelarlo.", confirmText: "Eliminar", cancelText: "Volver" }))) return
    try { await deleteOrder(id); toast.success("Orden eliminada"); navigate("/taller?tab=orders") } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) }
  }

  if (!order) return <Container><Text size="small" className="text-ui-fg-subtle">Cargando…</Text></Container>

  const acts = order.activities || []
  const total = acts.reduce((s, a) => s + a.hours, 0)
  const done = acts.filter((a) => a.status === "done").reduce((s, a) => s + a.hours, 0)
  const actual = acts.reduce((s, a) => s + (a.actual_hours || 0), 0)
  const left = daysUntil(order.due_date)
  const isOpen = OPEN_STAGES.includes(order.stage)
  const next = NEXT[order.stage]
  const checksDone = checks.filter((c) => c.done).length
  const released = ["released", "delivered", "closed"].includes(order.stage)
  const checksDirty = JSON.stringify(checks) !== JSON.stringify(order.checklist)
  const canRelease = !order.blocked && checks.length > 0 && checksDone === checks.length && !checksDirty
  const stageIndex = STAGES.indexOf(order.stage)
  const inspectionPhotos = (order.photos || []).filter((p) => p.kind === "inspection").length
  const deliveryPhotos = (order.photos || []).filter((p) => p.kind === "delivery").length

  return (
    <div className="flex flex-col gap-3">
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
          <div className="flex items-start gap-3">
            <IconButton size="small" variant="transparent" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft /></IconButton>
            <div>
              <Text size="small" className="text-ui-fg-subtle">{order.number} · {TYPE_LABEL[order.type]}</Text>
              <Heading level="h1">{order.title}{order.quantity > 1 ? ` ×${order.quantity}` : ""}</Heading>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge size="2xsmall" color={companyColor(order.company)}>{companyLabel(order.company)}</Badge>
                <Badge size="2xsmall" color={stageColor(order.stage)}>{STAGE_LABEL[order.stage]}</Badge>
                <Badge size="2xsmall" color={priorityColor(order.priority)}>Prioridad {PRIORITY_LABEL[order.priority].toLowerCase()}</Badge>
                {order.blocked && <Badge size="2xsmall" color="red">Bloqueada</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" asChild><a href={orderPdfUrl(order.id)} target="_blank" rel="noreferrer">Imprimir (PDF)</a></Button>
            <Button size="small" variant="secondary" onClick={startEdit}>Editar datos</Button>
            {next && next.stage !== "released" && next.stage !== "delivered" && <Button size="small" onClick={() => changeStage(next.stage)} isLoading={busy}>{next.label}</Button>}
          </div>
        </div>

        {/* Stage stepper: click to move; the server enforces the quality rules */}
        <div className="overflow-x-auto px-6 py-4">
          {order.stage === "cancelled" ? (
            <div className="flex flex-wrap items-center gap-3"><Badge color="red">Orden cancelada</Badge><Button size="small" variant="secondary" onClick={() => changeStage("preparation")}>Reabrir en Preparación</Button></div>
          ) : (
            <div className="flex min-w-[720px] items-center gap-1">
              {STAGES.map((s, i) => (
                <button key={s} type="button" disabled={busy || s === order.stage} onClick={() => changeStage(s)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-center text-xs transition-colors ${s === order.stage ? "border-ui-border-interactive bg-ui-bg-highlight font-semibold text-ui-fg-interactive" : i < stageIndex ? "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle hover:bg-ui-bg-base-hover" : "border-dashed border-ui-border-base text-ui-fg-muted hover:bg-ui-bg-base-hover"}`}>
                  {i < stageIndex ? "✓ " : ""}{STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </Container>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-3">
          <Container className="grid gap-4 sm:grid-cols-3">
            <Info label="Entrega comprometida">{fmtDay(order.due_date)}{left !== null && isOpen && <span className={left < 0 ? "text-ui-fg-error" : left <= 3 ? "text-ui-tag-orange-text" : "text-ui-fg-subtle"}> · {left < 0 ? `atrasada ${-left} d` : left === 0 ? "hoy" : `en ${left} d`}</span>}</Info>
            <Info label="Terminación interna">{fmtDay(order.finish_date)}</Info>
            <Info label="Cliente">
              {order.customer_id ? <Link to={`/clientes/${order.customer_id}`} className="text-ui-fg-interactive hover:underline">{order.client_name || "Ver cliente"}</Link> : order.client_name || "—"}
              {order.quote_number && <> · {order.quote_id ? <Link to={`/cotizaciones/${order.quote_id}`} className="text-ui-fg-interactive hover:underline">Cot. {order.quote_number}</Link> : `Cot. ${order.quote_number}`}</>}
            </Info>
            <Info label="Responsable">{(order.owner_id && people.get(order.owner_id)?.name) || "—"}</Info>
            <Info label="Materiales"><Badge size="2xsmall" color={materialsColor(order.materials)}>{MATERIALS_LABEL[order.materials]}</Badge>{order.materials_note && order.materials !== "complete" && <span className="text-ui-fg-subtle"> · {(order.material_lines || []).length ? "falta " : ""}{order.materials_note}</span>}</Info>
            <Info label="Horas">{hours(done)} de {hours(total)} hechas{actual ? ` · ${hours(actual)} reales` : ""}</Info>
            {order.next_action && <div className="sm:col-span-3"><Info label="Siguiente acción">{order.next_action}</Info></div>}
            {order.description && <div className="sm:col-span-3"><Info label="Descripción"><span className="whitespace-pre-line">{order.description}</span></Info></div>}
          </Container>

          <Container className="p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <div><Heading level="h2">Operaciones</Heading><Text size="xsmall" className="text-ui-fg-subtle">Pulse una fila para programarla; el estado cambia con un clic (Pendiente → En proceso → Hecho).</Text></div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <Table.Header><Table.Row><Table.HeaderCell>Operación</Table.HeaderCell><Table.HeaderCell>Responsable</Table.HeaderCell><Table.HeaderCell>Fecha</Table.HeaderCell><Table.HeaderCell>Horas</Table.HeaderCell><Table.HeaderCell>Estado</Table.HeaderCell></Table.Row></Table.Header>
                <Table.Body>
                  {acts.map((a) => (
                    <Table.Row key={a.id} className="cursor-pointer" onClick={() => setEditing(a)}>
                      <Table.Cell><Text size="small" weight="plus">{a.name}</Text>{a.notes && <Text size="xsmall" className="max-w-[260px] truncate text-ui-fg-subtle">{a.notes}</Text>}</Table.Cell>
                      <Table.Cell>{(a.resource_id && people.get(a.resource_id)?.name) || <span className="text-ui-fg-muted">Sin asignar</span>}</Table.Cell>
                      <Table.Cell>{a.date ? fmtDay(a.date) : <span className="text-ui-tag-orange-text">Por programar</span>}</Table.Cell>
                      <Table.Cell>{hours(a.hours)}{a.actual_hours !== null ? <span className="text-ui-fg-subtle"> / {hours(a.actual_hours)}</span> : ""}</Table.Cell>
                      <Table.Cell><button type="button" onClick={(e) => { e.stopPropagation(); quickStatus(a) }} title="Cambiar estado"><Badge size="2xsmall" color={activityColor(a.status)}>{ACTIVITY_LABEL[a.status]}</Badge></button></Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
            {acts.length === 0 && <Text size="small" className="px-6 py-4 text-ui-fg-subtle">Sin operaciones todavía.</Text>}
            <div className="grid gap-2 border-t border-ui-border-base px-6 py-4 sm:grid-cols-[1fr_180px_150px_80px_auto]">
              <Input size="small" placeholder="Nueva operación (ej. Soldadura TIG)" value={act.name} onChange={(e) => setAct({ ...act, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addAct() }} />
              <ResourceSelect size="small" value={act.resource_id} onChange={(v) => setAct({ ...act, resource_id: v })} resources={resources} />
              <Input size="small" type="date" value={act.date} onChange={(e) => setAct({ ...act, date: e.target.value })} aria-label="Fecha" />
              <Input size="small" type="number" min={0.25} step={0.25} value={act.hours} onChange={(e) => setAct({ ...act, hours: e.target.value })} aria-label="Horas" />
              <Button size="small" variant="secondary" onClick={addAct} disabled={busy}>Añadir</Button>
            </div>
          </Container>

          <WorkMaterials order={order} onChange={setOrder} />

          <WorkPhotos order={order} onChange={setOrder} />
        </div>

        <div className="flex flex-col gap-3">
          {/* Blocker */}
          <Container className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><Heading level="h2">Bloqueo</Heading><Switch checked={blocked} onCheckedChange={setBlocked} aria-label="Bloqueo activo" /></div>
            {blocked ? <Input placeholder="Causa: falta tina del proveedor, doblez externo…" value={blocker} onChange={(e) => setBlocker(e.target.value)} /> : <Text size="small" className="text-ui-fg-subtle">Sin bloqueo. Actívelo si el trabajo está detenido por material, proveedor o una decisión del cliente.</Text>}
            {(blocked !== order.blocked || (blocked && blocker !== (order.blocker || ""))) && <Button size="small" onClick={() => run(() => updateOrder(id, { blocked, blocker: blocked ? blocker.trim() || null : null }), blocked ? "Bloqueo registrado" : "Bloqueo resuelto")} isLoading={busy}>Guardar bloqueo</Button>}
          </Container>

          {/* Quality */}
          <Container className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><Heading level="h2">Inspección y liberación</Heading><Badge size="2xsmall" color={checksDone === checks.length && checks.length ? "green" : "grey"}>{checksDone}/{checks.length}</Badge></div>
            <div className="flex flex-col gap-2">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox id={`chk-${i}`} checked={c.done} disabled={released} onCheckedChange={(v) => setChecks(checks.map((x, j) => (j === i ? { ...x, done: v === true } : x)))} />
                  <Label htmlFor={`chk-${i}`} size="small" className="flex-1">{c.label}</Label>
                  {!released && <IconButton size="2xsmall" variant="transparent" onClick={() => setChecks(checks.filter((_, j) => j !== i))} aria-label="Quitar punto"><Trash /></IconButton>}
                </div>
              ))}
            </div>
            {!released && (
              <div className="flex gap-2">
                <Input size="small" placeholder="Añadir punto de control" value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newCheck.trim()) { setChecks([...checks, { label: newCheck.trim(), done: false }]); setNewCheck("") } }} />
                <Button size="small" variant="secondary" disabled={!newCheck.trim()} onClick={() => { setChecks([...checks, { label: newCheck.trim(), done: false }]); setNewCheck("") }}>Añadir</Button>
              </div>
            )}
            {checksDirty && <Button size="small" variant="secondary" onClick={() => run(() => updateOrder(id, { checklist: checks }), "Inspección guardada")} isLoading={busy}>Guardar inspección</Button>}
            <div className="flex items-center justify-between gap-2 rounded-md bg-ui-bg-subtle px-3 py-2">
              <Text size="xsmall" className={inspectionPhotos || released ? "text-ui-fg-subtle" : "text-ui-tag-orange-text"}>{inspectionPhotos ? `${inspectionPhotos} foto${inspectionPhotos === 1 ? "" : "s"} de inspección` : released ? "Sin fotos de inspección" : "Sin fotos de inspección (recomendado antes de liberar)"}</Text>
              {!released && <PhotoUpload order={order} kind="inspection" onChange={setOrder} label="Foto" />}
            </div>
            {released ? (
              <Text size="small" className="text-ui-tag-green-text">Liberada el {fmtDateTime(order.released_at)}{order.inspected_by ? ` por ${order.inspected_by}` : ""}.</Text>
            ) : (
              <>
                <Button size="small" disabled={!canRelease || busy} onClick={() => changeStage("released")}>Registrar liberación de calidad</Button>
                <Text size="xsmall" className="text-ui-fg-subtle">{order.blocked ? "No se puede liberar con un bloqueo activo." : checksDirty ? "Guarde la inspección antes de liberar." : checksDone < checks.length ? "Se libera con todos los puntos verificados." : "Lista completa: puede liberar."}</Text>
              </>
            )}
          </Container>

          {/* Delivery */}
          {released && (
            <Container className="flex flex-col gap-3">
              <Heading level="h2">Entrega</Heading>
              {order.delivered_at ? (
                <>
                  <Text size="small">Entregada el {fmtDateTime(order.delivered_at)}.</Text>
                  {order.delivery_note && <Text size="small" className="text-ui-fg-subtle">{order.delivery_note}</Text>}
                  {order.stage === "delivered" && <Button size="small" variant="secondary" onClick={() => changeStage("closed")}>Cerrar orden</Button>}
                </>
              ) : (
                <>
                  <Textarea rows={2} placeholder="Recibido por, lugar, número de guía o acta…" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
                  <div className="flex items-center justify-between gap-2 rounded-md bg-ui-bg-subtle px-3 py-2">
                    <Text size="xsmall" className="text-ui-fg-subtle">{deliveryPhotos ? `${deliveryPhotos} foto${deliveryPhotos === 1 ? "" : "s"} de entrega` : "Sin fotos de entrega"}</Text>
                    <PhotoUpload order={order} kind="delivery" onChange={setOrder} label="Foto" />
                  </div>
                  <Button size="small" onClick={() => changeStage("delivered")} isLoading={busy} disabled={!deliveryNote.trim() && !deliveryPhotos}>Registrar entrega</Button>
                  <Text size="xsmall" className="text-ui-fg-subtle">Se registra con quién la recibió o con una foto de la entrega.</Text>
                </>
              )}
            </Container>
          )}

          {/* History */}
          <Container className="flex flex-col gap-3">
            <Heading level="h2">Historial</Heading>
            <div className="flex max-h-[360px] flex-col gap-2.5 overflow-y-auto">
              {(order.events || []).map((e) => (
                <div key={e.id} className="border-l-2 border-ui-border-base pl-3">
                  <Text size="small">{e.action === "created" ? "Orden creada" : e.note || e.action}</Text>
                  <Text size="xsmall" className="text-ui-fg-muted">{fmtDateTime(e.created_at)}{e.actor_email ? ` · ${e.actor_email}` : ""}</Text>
                </div>
              ))}
            </div>
          </Container>

          <div className="flex flex-wrap gap-2">
            {order.stage !== "cancelled" && order.stage !== "closed" && <Button size="small" variant="secondary" onClick={() => changeStage("cancelled")}>Cancelar orden</Button>}
            <Button size="small" variant="danger" onClick={remove}>Eliminar</Button>
          </div>
        </div>
      </div>

      <ActivityDrawer activity={editing} order={order} resources={resources} onClose={() => setEditing(null)} onSaved={load} />

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="small" onClick={saveEdit} isLoading={busy}>Guardar</Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
              <FocusModal.Title asChild><Heading level="h1">{order.number} · Editar datos</Heading></FocusModal.Title>
              {draft && <WorkOrderForm value={draft} onChange={setDraft} resources={resources} materialsLocked={(order.material_lines?.length || 0) > 0} />}
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </div>
  )
}

export default WorkOrderPage
