import { Badge, Button, Container, FocusModal, Heading, Input, Label, Select, Table, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CATEGORIES, UNITS, createItem, deleteItem, emptyItem, errorMessage, fmtDate, itemToInput, listItems, money, updateItem, type ItemInput, type PurchaseItem } from "../../../lib/purchases"

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">{label}</Label>{children}{hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}</div>
)

/** /compras/materiales — materials and supplies catalogue with the last price paid. */
const MaterialsPage = () => {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PurchaseItem | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<ItemInput>(emptyItem())
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => { setLoading(true); const t = setTimeout(() => listItems(q.trim() || undefined).then(({ items }) => setRows(items)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))).finally(() => setLoading(false)), q ? 250 : 0); return () => clearTimeout(t) }, [q, tick])

  const text = (k: keyof ItemInput) => ({ value: value[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue({ ...value, [k]: e.target.value }) })
  const startNew = () => { setEditing(null); setValue(emptyItem()); setOpen(true) }
  const startEdit = (it: PurchaseItem) => { setEditing(it); setValue(itemToInput(it)); setOpen(true) }
  const save = async () => {
    if (!value.name.trim()) { toast.error("Escriba el nombre del material"); return }
    setBusy(true)
    try { if (editing) await updateItem(editing.id, value); else await createItem(value); toast.success("Material guardado"); setOpen(false); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const toggle = async (it: PurchaseItem) => { try { await updateItem(it.id, { active: !it.active }); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo actualizar")) } }
  const remove = async (it: PurchaseItem) => { if (!window.confirm(`¿Eliminar "${it.name}" del catálogo? Las órdenes anteriores conservan la línea.`)) return; try { await deleteItem(it.id); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) } }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div><Heading level="h1">Materiales e insumos</Heading><Text size="small" className="text-ui-fg-subtle">Lo que se compra a proveedores. El último precio se actualiza solo al recibir una orden.</Text></div>
        <div className="flex gap-2"><Button size="small" variant="secondary" onClick={() => navigate("/compras")}>Volver a compras</Button><Button size="small" onClick={startNew}>Nuevo material</Button></div>
      </div>
      <div className="px-6 py-3"><Input size="small" placeholder="Nombre, referencia o categoría" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" /></div>
      <Table>
        <Table.Header><Table.Row><Table.HeaderCell>Material</Table.HeaderCell><Table.HeaderCell>Categoría</Table.HeaderCell><Table.HeaderCell>Unidad</Table.HeaderCell><Table.HeaderCell className="text-right">Último precio</Table.HeaderCell><Table.HeaderCell>Último proveedor</Table.HeaderCell><Table.HeaderCell>Estado</Table.HeaderCell><Table.HeaderCell /></Table.Row></Table.Header>
        <Table.Body>
          {rows.map((it) => (
            <Table.Row key={it.id}>
              <Table.Cell><Text size="small" weight="plus">{it.ref ? <span className="mr-1 font-mono text-[11px] text-ui-fg-muted">[{it.ref}]</span> : null}{it.name}</Text></Table.Cell>
              <Table.Cell>{it.category || <span className="text-ui-fg-muted">—</span>}</Table.Cell>
              <Table.Cell>{it.unit}</Table.Cell>
              <Table.Cell className="text-right">{it.last_price != null ? money(Number(it.last_price)) : <span className="text-ui-fg-muted">—</span>}</Table.Cell>
              <Table.Cell><Text size="small">{it.last_supplier_name || ""}</Text><Text size="xsmall" className="text-ui-fg-subtle">{it.last_bought_at ? fmtDate(it.last_bought_at) : ""}</Text></Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={it.active ? "green" : "grey"}>{it.active ? "Activo" : "Inactivo"}</Badge></Table.Cell>
              <Table.Cell><div className="flex justify-end gap-1"><Button size="small" variant="transparent" onClick={() => startEdit(it)}>Editar</Button><Button size="small" variant="transparent" onClick={() => toggle(it)}>{it.active ? "Inactivar" : "Activar"}</Button><Button size="small" variant="transparent" onClick={() => remove(it)}>Eliminar</Button></div></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!loading && rows.length === 0 && <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">Sin materiales. También se crean desde el buscador de una orden.</Text></div>}
      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content className="max-w-2xl">
          <FocusModal.Header><Heading level="h2">{editing ? "Editar material" : "Nuevo material"}</Heading></FocusModal.Header>
          <FocusModal.Body className="grid gap-4 overflow-y-auto p-6 md:grid-cols-2">
            <div className="md:col-span-2"><Field label="Nombre"><Input placeholder="LAMINA DE ACERO INOXIDABLE CALIBRE 18 (1.20 MM) 4 X 8 PIES (AISI304 NO4)" {...text("name")} /></Field></div>
            <Field label="Referencia / código del proveedor"><Input placeholder="26451830" {...text("ref")} /></Field>
            <Field label="Categoría">
              <Select value={value.category || "__none"} onValueChange={(v) => setValue({ ...value, category: v === "__none" ? "" : v })}><Select.Trigger><Select.Value placeholder="Seleccionar" /></Select.Trigger><Select.Content><Select.Item value="__none">Sin categoría</Select.Item>{CATEGORIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content></Select>
            </Field>
            <Field label="Unidad de compra">
              <Select value={value.unit} onValueChange={(v) => setValue({ ...value, unit: v })}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content>{UNITS.map((u) => <Select.Item key={u} value={u}>{u}</Select.Item>)}</Select.Content></Select>
            </Field>
            <Field label="Precio de referencia (B/.)" hint="Se actualiza con cada recepción."><Input type="number" min={0} step="0.01" {...text("last_price")} /></Field>
            <div className="md:col-span-2"><Field label="Descripción (opcional)" hint="Sale bajo la línea en la orden."><Textarea rows={2} {...text("description")} /></Field></div>
          </FocusModal.Body>
          <FocusModal.Footer><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" isLoading={busy} onClick={save}>Guardar material</Button></FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export default MaterialsPage
