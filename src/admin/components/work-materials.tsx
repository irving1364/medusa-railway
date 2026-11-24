import { Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, IconButton, Input, Select, Table, Text, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { STATUS, UNITS, fmtQty, listItems, type PurchaseItem, type PurchaseStatus } from "../lib/purchases"
import { addMaterial, consumeMaterial, deleteMaterial, errorMessage, updateMaterial, type Material, type WorkOrder } from "../lib/workshop"

/** Search in the materials catalogue of Compras, or free text when the material is not there. */
function ItemSearch({ value, onText, onPick }: { value: string; onText: (v: string) => void; onPick: (it: PurchaseItem) => void }) {
  const [results, setResults] = useState<PurchaseItem[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (value.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => listItems(value.trim(), true).then(({ items }) => { setResults(items.slice(0, 12)); setOpen(true) }).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [value])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  return (
    <div ref={box} className="relative">
      <Input size="small" placeholder="Buscar en materiales de Compras o escribir uno nuevo" value={value} onChange={(e) => onText(e.target.value)} onFocus={() => results.length && setOpen(true)} />
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
          {results.map((it) => (
            <li key={it.id}>
              <button type="button" className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-ui-bg-subtle" onClick={() => { onPick(it); setOpen(false) }}>
                <span>{it.ref ? <span className="mr-1 font-mono text-[11px] text-ui-fg-muted">[{it.ref}]</span> : null}{it.name}</span>
                <span className="shrink-0 text-ui-fg-subtle">Stock {fmtQty(it.stock)} {it.unit.toLowerCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Materials of a work order: what it needs, what the workshop already took from stock and what has to be bought.
 * Consuming discounts the stock of the catalogue item; returning puts it back.
 */
export default function WorkMaterials({ order, onChange }: { order: WorkOrder; onChange: (o: WorkOrder) => void }) {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const lines = order.material_lines || []
  const closed = order.stage === "closed" || order.stage === "cancelled"
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<{ text: string; item: PurchaseItem | null; qty: string; unit: string }>({ text: "", item: null, qty: "1", unit: "Unidades" })
  const [moving, setMoving] = useState<{ id: string; qty: string; note: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; qty: string } | null>(null)

  const run = async <T extends { order: WorkOrder; warnings?: string[] }>(fn: () => Promise<T>, ok: string) => {
    setBusy(true)
    try { const r = await fn(); onChange(r.order); (r.warnings || []).forEach((w) => toast.warning(w)); toast.success(ok); return true } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")); return false } finally { setBusy(false) }
  }

  const add = async () => {
    const qty = Number(draft.qty)
    if (!(qty > 0)) { toast.error("Indique la cantidad"); return }
    if (!draft.item && !draft.text.trim()) { toast.error("Elija o escriba el material"); return }
    const body = draft.item ? { item_id: draft.item.id, required: qty } : { name: draft.text.trim(), unit: draft.unit, required: qty }
    if (await run(() => addMaterial(order.id, body), "Material añadido")) setDraft({ text: "", item: null, qty: "1", unit: "Unidades" })
  }
  const move = async (m: Material, sign: 1 | -1) => {
    if (!moving) return
    const qty = Number(moving.qty)
    if (!(qty > 0)) { toast.error("Indique la cantidad"); return }
    if (await run(() => consumeMaterial(m.id, sign * qty, moving.note.trim()), sign > 0 ? "Consumo registrado" : "Devuelto al stock")) setMoving(null)
  }
  const saveRequired = async (m: Material) => {
    if (!editing) return
    const qty = Number(editing.qty)
    if (!(qty > 0)) { toast.error("Indique la cantidad"); return }
    if (await run(() => updateMaterial(m.id, { required: qty }), "Cantidad actualizada")) setEditing(null)
  }
  const remove = async (m: Material) => {
    if (!(await prompt({ title: "Quitar material", description: `Se quita «${m.name}» de la orden.`, confirmText: "Quitar", cancelText: "Volver" }))) return
    await run(() => deleteMaterial(m.id), "Material quitado")
  }

  const toBuy = lines.filter((m) => m.shortfall > 0)
  const unit = (m: Material) => m.unit.toLowerCase()

  return (
    <Container className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h2">Materiales</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle">Lo que necesita el trabajo. «Consumir» descuenta del stock de Compras → Materiales; «Devolver» lo repone.</Text>
        </div>
        {toBuy.length > 0 && !closed && <Button size="small" variant="secondary" onClick={() => navigate(`/compras/new?taller=${order.id}`)}>Comprar lo que falta ({toBuy.length})</Button>}
      </div>
      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header><Table.Row><Table.HeaderCell>Material</Table.HeaderCell><Table.HeaderCell>Necesario</Table.HeaderCell><Table.HeaderCell>Consumido</Table.HeaderCell><Table.HeaderCell>En stock</Table.HeaderCell><Table.HeaderCell>Falta comprar</Table.HeaderCell><Table.HeaderCell /></Table.Row></Table.Header>
            <Table.Body>
              {lines.map((m) => [
                <Table.Row key={m.id}>
                  <Table.Cell className="max-w-[280px]">
                    <Text size="small" weight="plus" className="truncate">{m.item_ref ? <span className="mr-1 font-mono text-[11px] text-ui-fg-muted">[{m.item_ref}]</span> : null}{m.name}</Text>
                    {!m.item_id && <Text size="xsmall" className="text-ui-fg-muted">Fuera del catálogo: no mueve stock</Text>}
                  </Table.Cell>
                  <Table.Cell>
                    {editing?.id === m.id ? (
                      <div className="flex items-center gap-1"><Input size="small" type="number" min={0} step="any" className="w-20" value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveRequired(m); if (e.key === "Escape") setEditing(null) }} autoFocus /><Button size="small" variant="transparent" onClick={() => saveRequired(m)}>OK</Button></div>
                    ) : (
                      <button type="button" disabled={closed} className="hover:underline" onClick={() => setEditing({ id: m.id, qty: String(m.required) })} title="Cambiar cantidad">{fmtQty(m.required)} {unit(m)}</button>
                    )}
                  </Table.Cell>
                  <Table.Cell><span className={m.consumed >= m.required ? "text-ui-tag-green-text" : ""}>{fmtQty(m.consumed)}</span></Table.Cell>
                  <Table.Cell>{m.stock === null ? <span className="text-ui-fg-muted">—</span> : <span className={m.stock < 0 ? "text-ui-fg-error" : m.min_stock !== null && m.stock <= m.min_stock ? "text-ui-tag-orange-text" : ""}>{fmtQty(m.stock)}</span>}</Table.Cell>
                  <Table.Cell>{m.shortfall > 0 ? <Badge size="2xsmall" color="red">{fmtQty(m.shortfall)} {unit(m)}</Badge> : m.remaining === 0 ? <Badge size="2xsmall" color="green">Consumido</Badge> : <Badge size="2xsmall" color="green">Cubierto</Badge>}</Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      {!closed && <Button size="small" variant="secondary" onClick={() => setMoving(moving?.id === m.id ? null : { id: m.id, qty: String(m.remaining || 1), note: "" })}>Consumo</Button>}
                      {m.consumed === 0 && !closed && <IconButton size="small" variant="transparent" onClick={() => remove(m)} aria-label="Quitar"><Trash /></IconButton>}
                    </div>
                  </Table.Cell>
                </Table.Row>,
                moving?.id === m.id && (
                  <Table.Row key={`${m.id}-move`} className="bg-ui-bg-subtle">
                    <td colSpan={6} className="px-6 py-2">
                      <div className="flex flex-wrap items-center gap-2 py-1">
                        <Text size="small">Cantidad ({unit(m)})</Text>
                        <Input size="small" type="number" min={0} step="any" className="w-24" value={moving.qty} onChange={(e) => setMoving({ ...moving, qty: e.target.value })} autoFocus />
                        <Input size="small" className="min-w-[200px] flex-1" placeholder="Nota (opcional): retazo, merma, devolución…" value={moving.note} onChange={(e) => setMoving({ ...moving, note: e.target.value })} />
                        <Button size="small" onClick={() => move(m, 1)} isLoading={busy}>Consumir</Button>
                        {m.consumed > 0 && <Button size="small" variant="secondary" onClick={() => move(m, -1)} disabled={busy}>Devolver</Button>}
                        <Button size="small" variant="transparent" onClick={() => setMoving(null)}>Cancelar</Button>
                      </div>
                    </td>
                  </Table.Row>
                ),
              ])}
            </Table.Body>
          </Table>
        </div>
      )}
      {lines.length === 0 && <Text size="small" className="px-6 pb-4 text-ui-fg-subtle">Sin materiales. Añádalos para controlar el stock y saber qué comprar; mientras tanto, el estado de materiales se marca a mano.</Text>}
      {!closed && (
        <div className="grid gap-2 border-t border-ui-border-base px-6 py-4 sm:grid-cols-[1fr_100px_140px_auto]">
          <ItemSearch value={draft.item ? draft.item.name : draft.text} onText={(text) => setDraft({ ...draft, text, item: null, unit: draft.item ? "Unidades" : draft.unit })} onPick={(item) => setDraft({ ...draft, item, text: item.name, unit: item.unit })} />
          <Input size="small" type="number" min={0} step="any" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} aria-label="Cantidad de material" />
          {draft.item ? <Input size="small" value={draft.item.unit} disabled /> : (
            <Select size="small" value={draft.unit} onValueChange={(unit) => setDraft({ ...draft, unit })}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{UNITS.map((u) => <Select.Item key={u} value={u}>{u}</Select.Item>)}</Select.Content>
            </Select>
          )}
          <Button size="small" variant="secondary" onClick={add} disabled={busy} aria-label="Añadir material">Añadir</Button>
        </div>
      )}
      {(order.purchase_orders || []).length > 0 && (
        <div className="flex flex-col gap-2 border-t border-ui-border-base px-6 py-4">
          <Text size="small" weight="plus">Compras para esta orden</Text>
          {(order.purchase_orders || []).map((p) => {
            const st = STATUS[p.status as PurchaseStatus]
            return (
              <Link key={p.id} to={`/compras/${p.id}`} className="flex items-center justify-between gap-2 rounded-md border border-ui-border-base px-3 py-2 hover:bg-ui-bg-base-hover">
                <Text size="small"><span className="font-medium">{p.number}</span> · {p.supplier_name}</Text>
                {st && <Badge size="2xsmall" color={st.color}>{st.label}</Badge>}
              </Link>
            )
          })}
        </div>
      )}
    </Container>
  )
}
