import { Badge, Button, Drawer, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { STOCK_REASON, adjustStock, errorMessage, fmtQty, getStock, type PurchaseItem, type StockMovement } from "../lib/purchases"

const pad = (n: number) => String(n).padStart(2, "0")
const when = (s: string) => { const d = new Date(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
const refLink = (m: StockMovement) => (m.ref_type === "purchase_order" && m.ref_id ? `/compras/${m.ref_id}` : m.ref_type === "work_order" && m.ref_id ? `/taller/${m.ref_id}` : null)

/** Stock of one material: physical count and the movements (receipts, workshop consumption, returns, adjustments). */
export default function StockDrawer({ item, onClose, onChanged }: { item: PurchaseItem | null; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ stock: number; min_stock: number | null; unit: string; movements: StockMovement[] } | null>(null)
  const [count, setCount] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const load = (id: string) => getStock(id).then(setData).catch((e) => toast.error(errorMessage(e, "No se pudo cargar el stock")))
  useEffect(() => { setData(null); setCount(""); setNote(""); if (item) load(item.id) }, [item])

  const save = async () => {
    if (!item) return
    const n = Number(count)
    if (count.trim() === "" || !Number.isFinite(n) || n < 0) { toast.error("Indique la cantidad contada"); return }
    setBusy(true)
    try { await adjustStock(item.id, { count: n, note: note.trim() || null }); toast.success("Stock actualizado"); setCount(""); setNote(""); await load(item.id); onChanged() } catch (e) { toast.error(errorMessage(e, "No se pudo ajustar")) } finally { setBusy(false) }
  }

  const unit = (data?.unit || item?.unit || "").toLowerCase()
  return (
    <Drawer open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>Stock · {item?.name}</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          <div className="rounded-lg border border-ui-border-base p-4">
            <Text size="xsmall" className="text-ui-fg-subtle">En stock</Text>
            <Text className={`text-2xl font-semibold ${data && data.stock < 0 ? "text-ui-fg-error" : ""}`}>{data ? `${fmtQty(data.stock)} ${unit}` : "…"}</Text>
            {data?.min_stock !== null && data?.min_stock !== undefined && <Text size="xsmall" className={data.stock <= data.min_stock ? "text-ui-tag-orange-text" : "text-ui-fg-subtle"}>Mínimo {fmtQty(data.min_stock)} {unit}{data.stock <= data.min_stock ? " · conviene reponer" : ""}</Text>}
          </div>
          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus">Conteo físico</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">Escriba lo que hay en el taller; el sistema registra la diferencia como ajuste.</Text>
            <div className="flex gap-2"><Input type="number" min={0} step="any" placeholder={`Cantidad (${unit})`} value={count} onChange={(e) => setCount(e.target.value)} /><Button onClick={save} isLoading={busy}>Guardar</Button></div>
            <Input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus">Movimientos</Label>
            {data && data.movements.length === 0 && <Text size="small" className="text-ui-fg-subtle">Sin movimientos todavía.</Text>}
            {data?.movements.map((m) => {
              const to = refLink(m)
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 border-b border-ui-border-base pb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><Badge size="2xsmall" color={m.quantity > 0 ? "green" : "orange"}>{STOCK_REASON[m.reason]}</Badge>{m.ref_label && (to ? <Link to={to} className="txt-compact-small text-ui-fg-interactive hover:underline">{m.ref_label}</Link> : <Text size="small">{m.ref_label}</Text>)}</div>
                    {m.note && <Text size="xsmall" className="text-ui-fg-subtle">{m.note}</Text>}
                    <Text size="xsmall" className="text-ui-fg-muted">{when(m.created_at)}{m.actor_email ? ` · ${m.actor_email}` : ""}</Text>
                  </div>
                  <div className="shrink-0 text-right"><Text size="small" weight="plus" className={m.quantity > 0 ? "text-ui-tag-green-text" : ""}>{m.quantity > 0 ? "+" : ""}{fmtQty(m.quantity)}</Text><Text size="xsmall" className="text-ui-fg-muted">= {fmtQty(m.balance)}</Text></div>
                </div>
              )
            })}
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}
