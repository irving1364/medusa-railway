import { Badge, Button, Checkbox, Container, FocusModal, Heading, Input, Label, Select, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { Quote } from "../lib/quotes"
import { ACTIVITY_TEMPLATES, PRIORITY_LABEL, STAGE_LABEL, TYPE_LABEL, createOrder, errorMessage, fmtDay, listOrders, stageColor, type Priority, type WorkOrder, type WorkType } from "../lib/workshop"

interface Row { line_id: string; title: string; description: string | null; ref: string | null; quantity: number; selected: boolean; type: WorkType; sent: boolean }

/**
 * Quote → workshop: an approved quote sends its lines to the workshop, one work order per line,
 * carrying client, quote number and quantities. Lines already sent are marked.
 */
export default function QuoteWorkshopCard({ quote }: { quote: Quote }) {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [due, setDue] = useState("")
  const [priority, setPriority] = useState<Priority>("normal")
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => { listOrders({ quote_id: quote.id }).then(({ orders }) => setOrders(orders)).catch(() => {}) }, [quote.id, tick])

  const sentLines = new Set(orders.filter((o) => o.stage !== "cancelled").map((o) => String((o.metadata as Record<string, unknown> | null)?.quote_line_id || "")))
  const approved = quote.status === "approved"

  const start = () => {
    setRows(quote.lines.filter((l) => l.title.trim()).map((l) => {
      const sent = sentLines.has(l.id)
      return { line_id: l.id, title: l.title, description: l.description, ref: l.ref, quantity: Math.max(1, Math.round(Number(l.quantity) || 1)), selected: !sent, type: "fabrication", sent }
    }))
    setDue(""); setPriority("normal"); setOpen(true)
  }
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const send = async () => {
    const chosen = rows.filter((r) => r.selected)
    if (!chosen.length) { toast.error("Seleccione al menos una línea"); return }
    setBusy(true)
    const created: string[] = []
    try {
      for (const r of chosen) {
        const { order } = await createOrder({
          company: quote.store, type: r.type, title: r.title, quantity: r.quantity,
          description: [r.ref ? `Ref. ${r.ref}` : "", r.description || ""].filter(Boolean).join("\n"),
          client_name: quote.customer_company || quote.customer_name, customer_id: quote.customer_id || "", quote_id: quote.id, quote_number: quote.number,
          due_date: due, priority,
          activities: ACTIVITY_TEMPLATES[r.type].map((a) => ({ ...a, date: null, resource_id: null })),
          metadata: { quote_line_id: r.line_id },
        })
        created.push(order.number)
      }
      toast.success(`Enviado al taller: ${created.join(", ")}`)
      setOpen(false)
    } catch (e) {
      toast.error(`${created.length ? `Creadas ${created.join(", ")}. ` : ""}${errorMessage(e, "No se pudo crear la orden")}`)
    } finally {
      setBusy(false); setTick((n) => n + 1)
    }
  }

  return (
    <Container className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Heading level="h2">Taller</Heading>
        {orders.length > 0 && <Badge size="2xsmall">{orders.length}</Badge>}
      </div>
      {orders.map((o) => (
        <Link key={o.id} to={`/taller/${o.id}`} className="flex items-center justify-between gap-2 rounded-md border border-ui-border-base px-3 py-2 hover:bg-ui-bg-base-hover">
          <div className="min-w-0"><Text size="small" weight="plus">{o.number}</Text><Text size="xsmall" className="truncate text-ui-fg-subtle">{o.title}{o.quantity > 1 ? ` ×${o.quantity}` : ""} · {fmtDay(o.due_date)}</Text></div>
          <Badge size="2xsmall" color={stageColor(o.stage)}>{STAGE_LABEL[o.stage]}</Badge>
        </Link>
      ))}
      {approved ? (
        <Button size="small" variant={orders.length ? "secondary" : "primary"} onClick={start}>{orders.length ? "Enviar más líneas al taller" : "Enviar al taller"}</Button>
      ) : (
        <Text size="small" className="text-ui-fg-subtle">{orders.length ? "" : "Cuando el cliente apruebe la cotización podrá enviarla al taller como órdenes de trabajo."}</Text>
      )}

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="small" onClick={send} isLoading={busy}>Crear {rows.filter((r) => r.selected).length || ""} {rows.filter((r) => r.selected).length === 1 ? "orden" : "órdenes"}</Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="overflow-y-auto">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
              <div>
                <FocusModal.Title asChild><Heading level="h1">Enviar {quote.number} al taller</Heading></FocusModal.Title>
                <Text size="small" className="text-ui-fg-subtle">Se crea una orden de trabajo por línea, con el cliente, la cotización y las operaciones típicas del tipo de trabajo.</Text>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Entrega comprometida</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />{quote.lead_time && <Text size="xsmall" className="text-ui-fg-subtle">Plazo de la cotización: {quote.lead_time}</Text>}</div>
                <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Prioridad</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <Select.Item key={p} value={p}>{PRIORITY_LABEL[p]}</Select.Item>)}</Select.Content></Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <Table.Header><Table.Row><Table.HeaderCell /><Table.HeaderCell>Línea</Table.HeaderCell><Table.HeaderCell>Cantidad</Table.HeaderCell><Table.HeaderCell>Tipo de trabajo</Table.HeaderCell></Table.Row></Table.Header>
                  <Table.Body>
                    {rows.map((r, i) => (
                      <Table.Row key={r.line_id}>
                        <Table.Cell><Checkbox checked={r.selected} onCheckedChange={(v) => set(i, { selected: v === true })} aria-label="Enviar" /></Table.Cell>
                        <Table.Cell className="max-w-[380px]">
                          <Text size="small" weight="plus" className="truncate">{r.title}</Text>
                          {r.sent && <Badge size="2xsmall" color="orange">Ya enviada al taller</Badge>}
                        </Table.Cell>
                        <Table.Cell><Input size="small" type="number" min={1} className="w-20" value={r.quantity} onChange={(e) => set(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></Table.Cell>
                        <Table.Cell>
                          <Select size="small" value={r.type} onValueChange={(v) => set(i, { type: v as WorkType })}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content>{(Object.keys(TYPE_LABEL) as WorkType[]).map((t) => <Select.Item key={t} value={t}>{TYPE_LABEL[t]}</Select.Item>)}</Select.Content></Select>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">Desmarque las líneas que no pasan por el taller (transporte, instalación, productos de reventa…).</Text>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}
