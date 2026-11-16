import { Badge, Button, Container, FocusModal, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import SupplierForm from "../../../components/supplier-form"
import { createSupplier, deleteSupplier, emptySupplier, errorMessage, listSuppliers, supplierToInput, updateSupplier, type Supplier, type SupplierInput } from "../../../lib/purchases"

/** /compras/proveedores — suppliers list with create/edit in a modal. */
const SuppliersPage = () => {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<SupplierInput>(emptySupplier())
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => { setLoading(true); const t = setTimeout(() => listSuppliers(q.trim() || undefined).then(({ suppliers }) => setRows(suppliers)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))).finally(() => setLoading(false)), q ? 250 : 0); return () => clearTimeout(t) }, [q, tick])

  const startNew = () => { setEditing(null); setValue(emptySupplier()); setOpen(true) }
  const startEdit = (s: Supplier) => { setEditing(s); setValue(supplierToInput(s)); setOpen(true) }
  const save = async () => {
    if (!value.name.trim()) { toast.error("Escriba el nombre del proveedor"); return }
    setBusy(true)
    try { if (editing) await updateSupplier(editing.id, value); else await createSupplier(value); toast.success("Proveedor guardado"); setOpen(false); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const toggle = async (s: Supplier) => { try { await updateSupplier(s.id, { active: !s.active }); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo actualizar")) } }
  const remove = async (s: Supplier) => { if (!window.confirm(`¿Eliminar a ${s.name}? Las órdenes anteriores conservan sus datos.`)) return; try { await deleteSupplier(s.id); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) } }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div><Heading level="h1">Proveedores</Heading><Text size="small" className="text-ui-fg-subtle">A quién se compra. Compartidos por las dos empresas.</Text></div>
        <div className="flex gap-2"><Button size="small" variant="secondary" onClick={() => navigate("/compras")}>Volver a compras</Button><Button size="small" onClick={startNew}>Nuevo proveedor</Button></div>
      </div>
      <div className="px-6 py-3"><Input size="small" placeholder="Nombre, RUC, contacto o correo" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" /></div>
      <Table>
        <Table.Header><Table.Row><Table.HeaderCell>Proveedor</Table.HeaderCell><Table.HeaderCell>Contacto</Table.HeaderCell><Table.HeaderCell>R.U.C.</Table.HeaderCell><Table.HeaderCell>Términos</Table.HeaderCell><Table.HeaderCell>Estado</Table.HeaderCell><Table.HeaderCell /></Table.Row></Table.Header>
        <Table.Body>
          {rows.map((s) => (
            <Table.Row key={s.id}>
              <Table.Cell><Text size="small" weight="plus">{s.name}</Text>{s.address && <Text size="xsmall" className="truncate text-ui-fg-subtle">{s.address}</Text>}</Table.Cell>
              <Table.Cell><Text size="small">{s.contact_name || ""}</Text><Text size="xsmall" className="text-ui-fg-subtle">{[s.phone, s.email].filter(Boolean).join(" · ")}</Text></Table.Cell>
              <Table.Cell>{s.ruc ? `${s.ruc}${s.dv ? ` DV ${s.dv}` : ""}` : <span className="text-ui-fg-muted">—</span>}</Table.Cell>
              <Table.Cell><Text size="xsmall" className="line-clamp-2">{s.payment_terms || "—"}</Text></Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={s.active ? "green" : "grey"}>{s.active ? "Activo" : "Inactivo"}</Badge></Table.Cell>
              <Table.Cell><div className="flex justify-end gap-1"><Button size="small" variant="transparent" onClick={() => startEdit(s)}>Editar</Button><Button size="small" variant="transparent" onClick={() => toggle(s)}>{s.active ? "Inactivar" : "Activar"}</Button><Button size="small" variant="transparent" onClick={() => remove(s)}>Eliminar</Button></div></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!loading && rows.length === 0 && <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">Sin proveedores. Cree el primero.</Text></div>}
      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content className="max-w-2xl">
          <FocusModal.Header><Heading level="h2">{editing ? `Editar ${editing.name}` : "Nuevo proveedor"}</Heading></FocusModal.Header>
          <FocusModal.Body className="overflow-y-auto p-6"><SupplierForm value={value} onChange={setValue} /></FocusModal.Body>
          <FocusModal.Footer><Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" isLoading={busy} onClick={save}>Guardar proveedor</Button></FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export default SuppliersPage
