import { ArrowLeft } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Input, Switch, Table, Text, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Field } from "../../../components/work-order-form"
import { createResource, deleteResource, errorMessage, listResources, updateResource, type Resource } from "../../../lib/workshop"

interface Draft { name: string; role: string; weekly_capacity: string; daily_capacity: string }
const EMPTY: Draft = { name: "", role: "", weekly_capacity: "40", daily_capacity: "9" }

/** /taller/recursos — workshop people with their weekly and daily capacity (hours). */
const ResourcesPage = () => {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const [rows, setRows] = useState<Resource[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => { listResources().then(({ resources }) => setRows(resources)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))) }, [tick])

  const startEdit = (r: Resource) => { setEditing(r.id); setDraft({ name: r.name, role: r.role || "", weekly_capacity: String(r.weekly_capacity), daily_capacity: String(r.daily_capacity) }) }
  const reset = () => { setEditing(null); setDraft(EMPTY) }
  const save = async () => {
    if (!draft.name.trim()) { toast.error("Escriba el nombre"); return }
    const weekly = Number(draft.weekly_capacity), daily = Number(draft.daily_capacity)
    if (!(weekly >= 0 && weekly <= 168) || !(daily >= 0 && daily <= 24)) { toast.error("Revise las capacidades (semana ≤ 168 h, día ≤ 24 h)"); return }
    const body = { name: draft.name.trim(), role: draft.role.trim() || null, weekly_capacity: weekly, daily_capacity: daily }
    setBusy(true)
    try { if (editing) await updateResource(editing, body); else await createResource({ ...body, sort_order: rows.length }); toast.success("Guardado"); reset(); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const toggle = async (r: Resource) => { try { await updateResource(r.id, { active: !r.active }); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo actualizar")) } }
  const remove = async (r: Resource) => {
    if (!(await prompt({ title: `Eliminar a ${r.name}`, description: "Sus actividades quedan «Sin asignar». Si solo deja de trabajar un tiempo, es mejor desactivarlo.", confirmText: "Eliminar", cancelText: "Volver" }))) return
    try { await deleteResource(r.id); if (editing === r.id) reset(); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) }
  }

  return (
    <div className="flex flex-col gap-3">
      <Container className="divide-y p-0">
        <div className="flex items-start gap-3 px-6 py-4">
          <IconButton size="small" variant="transparent" onClick={() => navigate("/taller")} aria-label="Volver"><ArrowLeft /></IconButton>
          <div>
            <Heading level="h1">Recursos del taller</Heading>
            <Text size="small" className="text-ui-fg-subtle">Personas que ejecutan las operaciones y sus horas disponibles. El planificador avisa cuando alguien supera su capacidad diaria.</Text>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Header><Table.Row><Table.HeaderCell>Nombre</Table.HeaderCell><Table.HeaderCell>Función</Table.HeaderCell><Table.HeaderCell>Horas / semana</Table.HeaderCell><Table.HeaderCell>Horas / día</Table.HeaderCell><Table.HeaderCell>Activo</Table.HeaderCell><Table.HeaderCell /></Table.Row></Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.id} className={editing === r.id ? "bg-ui-bg-highlight" : ""}>
                  <Table.Cell><Text size="small" weight="plus">{r.name}</Text></Table.Cell>
                  <Table.Cell>{r.role || "—"}</Table.Cell>
                  <Table.Cell>{r.weekly_capacity} h</Table.Cell>
                  <Table.Cell>{r.daily_capacity} h</Table.Cell>
                  <Table.Cell><Switch checked={r.active} onCheckedChange={() => toggle(r)} aria-label="Activo" /></Table.Cell>
                  <Table.Cell><div className="flex justify-end gap-1"><Button size="small" variant="transparent" onClick={() => startEdit(r)}>Editar</Button><Button size="small" variant="transparent" onClick={() => remove(r)}>Eliminar</Button></div></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
        {rows.length === 0 && <Text size="small" className="px-6 py-4 text-ui-fg-subtle">Aún no hay personas. Añada a quienes trabajan en el taller (soldadura, corte y doblez, pulido, armado…).</Text>}
      </Container>

      <Container className="flex flex-col gap-4">
        <div className="flex items-center gap-2"><Heading level="h2">{editing ? "Editar persona" : "Añadir persona"}</Heading>{editing && <Badge size="2xsmall">Editando</Badge>}</div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Nombre" required><Input placeholder="Ej. José" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Función"><Input placeholder="Ej. Soldadura" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></Field>
          <Field label="Horas por semana"><Input type="number" min={0} max={168} value={draft.weekly_capacity} onChange={(e) => setDraft({ ...draft, weekly_capacity: e.target.value })} /></Field>
          <Field label="Horas por día" hint="Límite para el aviso de sobrecarga"><Input type="number" min={0} max={24} step={0.5} value={draft.daily_capacity} onChange={(e) => setDraft({ ...draft, daily_capacity: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          {editing && <Button size="small" variant="secondary" onClick={reset}>Cancelar</Button>}
          <Button size="small" onClick={save} isLoading={busy}>{editing ? "Guardar cambios" : "Añadir"}</Button>
        </div>
      </Container>
    </div>
  )
}

export default ResourcesPage
