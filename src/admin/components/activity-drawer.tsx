import { Badge, Button, Drawer, Input, Select, Text, Textarea, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ACTIVITY_LABEL, deleteActivity, errorMessage, updateActivity, type Activity, type ActivityStatus, type Resource, type WorkOrder } from "../lib/workshop"
import { Field, ResourceSelect } from "./work-order-form"

interface Draft { name: string; date: string; resource_id: string; hours: string; actual_hours: string; status: ActivityStatus; notes: string }
const toDraft = (a: Activity): Draft => ({ name: a.name, date: a.date || "", resource_id: a.resource_id || "", hours: String(a.hours), actual_hours: a.actual_hours === null ? "" : String(a.actual_hours), status: a.status, notes: a.notes || "" })

/** Side panel to plan one operation: day, person, hours, status. Warns (does not block) when the person is over capacity. */
export default function ActivityDrawer({ activity, order, resources, onClose, onSaved }: {
  activity: Activity | null
  order: WorkOrder | null | undefined
  resources: Resource[]
  onClose: () => void
  onSaved: () => void
}) {
  const prompt = usePrompt()
  const [d, setD] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setD(activity ? toDraft(activity) : null) }, [activity])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x))

  const save = async () => {
    if (!activity || !d) return
    const h = Number(d.hours)
    if (!d.name.trim()) { toast.error("Escriba la operación"); return }
    if (!(h > 0 && h <= 200)) { toast.error("Indique horas válidas"); return }
    const actual = d.actual_hours.trim() === "" ? null : Number(d.actual_hours)
    if (actual !== null && !(actual >= 0)) { toast.error("Horas reales no válidas"); return }
    setBusy(true)
    try {
      const { warnings } = await updateActivity(activity.id, { name: d.name.trim(), date: d.date || null, resource_id: d.resource_id || null, hours: h, actual_hours: actual, status: d.status, notes: d.notes.trim() || null })
      warnings.forEach((w) => toast.warning(w))
      toast.success("Actividad guardada")
      onSaved(); onClose()
    } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!activity) return
    if (!(await prompt({ title: "Eliminar actividad", description: `Se quitará «${activity.name}» de la orden.`, confirmText: "Eliminar", cancelText: "Cancelar" }))) return
    try { await deleteActivity(activity.id); toast.success("Actividad eliminada"); onSaved(); onClose() } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) }
  }

  return (
    <Drawer open={!!activity} onOpenChange={(o) => { if (!o) onClose() }}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>Actividad</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {order && (
            <div className="rounded-lg border border-ui-border-base p-3">
              <Text size="small" weight="plus">{order.number} · {order.title}</Text>
              {order.client_name && <Text size="xsmall" className="text-ui-fg-subtle">{order.client_name}</Text>}
              {order.blocked && <div className="mt-2"><Badge size="2xsmall" color="red">Bloqueada</Badge> <Text size="xsmall" as="span" className="text-ui-fg-error">{order.blocker}</Text></div>}
            </div>
          )}
          {d && (
            <>
              <Field label="Operación"><Input value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha" hint="Vacío = por programar"><Input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} /></Field>
                <Field label="Responsable"><ResourceSelect value={d.resource_id} onChange={(v) => set("resource_id", v)} resources={resources} /></Field>
                <Field label="Horas previstas"><Input type="number" min={0.25} step={0.25} value={d.hours} onChange={(e) => set("hours", e.target.value)} /></Field>
                <Field label="Horas reales"><Input type="number" min={0} step={0.5} placeholder="—" value={d.actual_hours} onChange={(e) => set("actual_hours", e.target.value)} /></Field>
              </div>
              <Field label="Estado">
                <Select value={d.status} onValueChange={(v) => set("status", v as ActivityStatus)}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>{(Object.keys(ACTIVITY_LABEL) as ActivityStatus[]).map((s) => <Select.Item key={s} value={s}>{ACTIVITY_LABEL[s]}</Select.Item>)}</Select.Content>
                </Select>
              </Field>
              <Field label="Notas"><Textarea rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observaciones del taller" /></Field>
              {order && <Link to={`/taller/${order.id}`} className="txt-compact-small text-ui-fg-interactive hover:underline">Ver orden completa →</Link>}
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="danger" size="small" onClick={remove} disabled={busy}>Eliminar</Button>
          <span className="flex-1" />
          <Drawer.Close asChild><Button variant="secondary" size="small">Cancelar</Button></Drawer.Close>
          <Button size="small" onClick={save} isLoading={busy}>Guardar</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
