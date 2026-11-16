import { Badge, Button, Container, FocusModal, Heading, Input, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { PAYMENT_METHODS, STATUS, addPayment, addReceipt, errorMessage, fmtDate, money, removePayment, setOrderStatus, todayISO, type Payment, type PurchaseEvent, type PurchaseOrder, type Receipt } from "../lib/purchases"

interface Props {
  order: PurchaseOrder
  receipts: Receipt[]
  payments: Payment[]
  events: PurchaseEvent[]
  dirty: boolean
  onChanged: (order: PurchaseOrder) => void
  onReload: () => void
  onSend: () => void
}

const ACTION_LABEL: Record<string, string> = { created: "Creada", updated: "Editada", sent: "Enviada por correo", "status:sent": "Marcada como enviada", "status:confirmed": "Confirmada por el proveedor", "status:cancelled": "Cancelada", "status:draft": "Reabierta como borrador", receipt: "Recepción de mercancía", payment: "Abono registrado", payment_removed: "Abono eliminado" }

/** Status, receipts, payments and history of a purchase order. */
export default function PurchaseStatusCard({ order, receipts, payments, events, dirty, onChanged, onReload, onSend }: Props) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [receipt, setReceipt] = useState<{ received_at: string; reference: string; note: string; qty: Record<string, string> }>({ received_at: todayISO(), reference: "", note: "", qty: {} })
  const [payment, setPayment] = useState({ paid_at: todayISO(), amount: "", method: "Transferencia", reference: "", note: "" })

  useEffect(() => { if (receiptOpen) setReceipt({ received_at: todayISO(), reference: order.invoice_reference || "", note: "", qty: Object.fromEntries(order.lines.map((l) => [l.id, String(Math.max(0, l.quantity - l.received_qty))])) }) }, [receiptOpen, order])
  useEffect(() => { if (paymentOpen) setPayment({ paid_at: todayISO(), amount: order.balance > 0 ? String(order.balance) : "", method: "Transferencia", reference: "", note: "" }) }, [paymentOpen, order])

  const change = async (status: "draft" | "sent" | "confirmed" | "cancelled", label: string) => {
    setBusy(status)
    try { const { order: updated } = await setOrderStatus(order.id, status, note.trim() || undefined); onChanged(updated); setNote(""); toast.success(label); onReload() } catch (e) { toast.error(errorMessage(e, "No se pudo cambiar el estado")) } finally { setBusy(null) }
  }
  const saveReceipt = async () => {
    const lines = order.lines.map((l) => ({ line_id: l.id, quantity: Number(receipt.qty[l.id]) || 0 })).filter((l) => l.quantity > 0)
    if (!lines.length) { toast.error("Indique al menos una cantidad recibida"); return }
    setBusy("receipt")
    try { const { order: updated } = await addReceipt(order.id, { received_at: receipt.received_at, reference: receipt.reference || null, note: receipt.note || null, lines }); onChanged(updated); setReceiptOpen(false); toast.success(updated.status === "received" ? "Orden recibida completa" : "Recepción parcial registrada"); onReload() } catch (e) { toast.error(errorMessage(e, "No se pudo registrar la recepción")) } finally { setBusy(null) }
  }
  const savePayment = async () => {
    const amount = Number(payment.amount)
    if (!(amount > 0)) { toast.error("Indique el monto del abono"); return }
    setBusy("payment")
    try { const { order: updated } = await addPayment(order.id, { paid_at: payment.paid_at, amount, method: payment.method || null, reference: payment.reference || null, note: payment.note || null }); onChanged(updated); setPaymentOpen(false); toast.success(`Abono de ${money(amount)} registrado`); onReload() } catch (e) { toast.error(errorMessage(e, "No se pudo registrar el abono")) } finally { setBusy(null) }
  }
  const dropPayment = async (p: Payment) => {
    if (!window.confirm(`¿Eliminar el abono de ${money(p.amount)} del ${fmtDate(p.paid_at)}?`)) return
    try { const { order: updated } = await removePayment(order.id, p.id); onChanged(updated); toast.success("Abono eliminado"); onReload() } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) }
  }

  const st = STATUS[order.status]
  const openForEdit = order.status === "draft" || order.status === "sent" || order.status === "confirmed"
  const canReceive = order.status === "sent" || order.status === "confirmed" || order.status === "partial"
  const pendingQty = order.lines.reduce((s, l) => s + Math.max(0, l.quantity - l.received_qty), 0)

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4"><Heading level="h2">Estado</Heading><Badge size="small" color={st.color}>{st.label}</Badge></div>
        <div className="flex flex-col gap-3 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-ui-fg-subtle">Total</span><span className="text-right font-medium">{money(order.total)}</span>
            <span className="text-ui-fg-subtle">Abonado</span><span className="text-right">{money(order.paid_total)}</span>
            <span className="text-ui-fg-subtle">Saldo</span><span className={`text-right font-medium ${order.balance > 0 ? "text-ui-fg-error" : "text-ui-fg-base"}`}>{money(order.balance)}</span>
            <span className="text-ui-fg-subtle">Por recibir</span><span className="text-right">{pendingQty > 0 ? `${pendingQty} unidad${pendingQty === 1 ? "" : "es"}` : "Nada"}</span>
            {order.expected_date && (<><span className="text-ui-fg-subtle">Llegada esperada</span><span className="text-right">{fmtDate(order.expected_date)}</span></>)}
          </div>
          {dirty && <Text size="xsmall" className="text-ui-fg-error">Guarde los cambios antes de enviar o cambiar el estado.</Text>}
          {openForEdit && <Textarea rows={2} placeholder="Nota para el historial (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />}
          <div className="flex flex-col gap-2">
            {openForEdit && <Button size="small" type="button" onClick={onSend} disabled={dirty || !order.lines.length}>Enviar al proveedor con PDF</Button>}
            {order.status === "draft" && <Button size="small" variant="secondary" type="button" isLoading={busy === "sent"} onClick={() => change("sent", "Marcada como enviada")} disabled={dirty || !order.lines.length}>Marcar como enviada (sin correo)</Button>}
            {(order.status === "draft" || order.status === "sent") && <Button size="small" variant="secondary" type="button" isLoading={busy === "confirmed"} onClick={() => change("confirmed", "Orden confirmada")} disabled={dirty || !order.lines.length}>Confirmada por el proveedor</Button>}
            {canReceive && <Button size="small" variant="secondary" type="button" onClick={() => setReceiptOpen(true)} disabled={dirty || pendingQty <= 0}>Registrar recepción</Button>}
            {order.status !== "cancelled" && order.balance > 0 && <Button size="small" variant="secondary" type="button" onClick={() => setPaymentOpen(true)} disabled={dirty}>Registrar abono</Button>}
            {order.status !== "cancelled" && order.status !== "received" && <Button size="small" variant="danger" type="button" isLoading={busy === "cancelled"} onClick={() => change("cancelled", "Orden cancelada")} disabled={dirty}>Cancelar orden</Button>}
            {(order.status === "cancelled" || order.status === "sent" || order.status === "confirmed") && <Button size="small" variant="transparent" type="button" isLoading={busy === "draft"} onClick={() => change("draft", "Orden reabierta como borrador")} disabled={dirty}>Volver a borrador</Button>}
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Abonos</Heading></div>
        <ul className="divide-y divide-ui-border-base">
          {payments.map((p) => (
            <li key={p.id} className="flex items-start gap-2 px-6 py-3">
              <div className="min-w-0 flex-1">
                <Text size="small" weight="plus">{money(p.amount)} · {p.method || "—"}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">{fmtDate(p.paid_at)}{p.reference ? ` · Ref. ${p.reference}` : ""}{p.actor_email ? ` · ${p.actor_email}` : ""}</Text>
                {p.note && <Text size="xsmall" className="whitespace-pre-line">{p.note}</Text>}
              </div>
              <Button size="small" variant="transparent" type="button" onClick={() => dropPayment(p)}>Quitar</Button>
            </li>
          ))}
          {payments.length === 0 && <li className="px-6 py-3"><Text size="small" className="text-ui-fg-subtle">Sin abonos registrados.</Text></li>}
        </ul>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Recepciones</Heading></div>
        <ul className="divide-y divide-ui-border-base">
          {receipts.map((r) => (
            <li key={r.id} className="px-6 py-3">
              <Text size="small" weight="plus">{fmtDate(r.received_at)}{r.reference ? ` · ${r.reference}` : ""}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">{r.lines.map((l) => { const line = order.lines.find((x) => x.id === l.line_id); return `${l.quantity} × ${line?.title || l.line_id}` }).join(" · ")}</Text>
              {r.note && <Text size="xsmall" className="whitespace-pre-line">{r.note}</Text>}
            </li>
          ))}
          {receipts.length === 0 && <li className="px-6 py-3"><Text size="small" className="text-ui-fg-subtle">Nada recibido todavía.</Text></li>}
        </ul>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Historial</Heading></div>
        <ul className="divide-y divide-ui-border-base">
          {events.map((e) => (
            <li key={e.id} className="px-6 py-3">
              <Text size="small" weight="plus">{ACTION_LABEL[e.action] || e.action}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">{fmtDate(e.created_at, true)}{e.actor_email ? ` · ${e.actor_email}` : ""}</Text>
              {e.note && <Text size="xsmall" className="mt-1 whitespace-pre-line">{e.note}</Text>}
              {e.data && typeof e.data.pdf_url === "string" && <a href={e.data.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-ui-fg-interactive hover:underline">PDF enviado</a>}
            </li>
          ))}
          {events.length === 0 && <li className="px-6 py-3"><Text size="small" className="text-ui-fg-subtle">Sin movimientos.</Text></li>}
        </ul>
      </Container>

      <FocusModal open={receiptOpen} onOpenChange={setReceiptOpen}>
        <FocusModal.Content className="max-w-2xl">
          <FocusModal.Header><Heading level="h2">Registrar recepción · {order.number}</Heading></FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Fecha de recepción</Label><Input type="date" value={receipt.received_at} onChange={(e) => setReceipt({ ...receipt, received_at: e.target.value })} /></div>
              <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Factura / remisión</Label><Input placeholder="F-000123" value={receipt.reference} onChange={(e) => setReceipt({ ...receipt, reference: e.target.value })} /></div>
            </div>
            <Text size="small" weight="plus">Cantidades recibidas</Text>
            <ul className="flex flex-col gap-2">
              {order.lines.map((l) => { const pending = Math.max(0, l.quantity - l.received_qty); return (
                <li key={l.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 rounded-md border border-ui-border-base px-3 py-2">
                  <div className="min-w-0"><Text size="small" className="truncate">{l.title}</Text><Text size="xsmall" className="text-ui-fg-subtle">Pedido {l.quantity} · recibido {l.received_qty} · faltan {pending} {l.unit}</Text></div>
                  <Input size="small" type="number" min={0} max={pending} step="0.01" value={receipt.qty[l.id] ?? ""} onChange={(e) => setReceipt({ ...receipt, qty: { ...receipt.qty, [l.id]: e.target.value } })} disabled={pending <= 0} />
                </li>) })}
            </ul>
            <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Nota</Label><Textarea rows={2} placeholder="Estado de la mercancía, faltantes, observaciones…" value={receipt.note} onChange={(e) => setReceipt({ ...receipt, note: e.target.value })} /></div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <Button variant="secondary" type="button" onClick={() => setReceiptOpen(false)}>Cancelar</Button>
            <Button type="button" isLoading={busy === "receipt"} onClick={saveReceipt}>Registrar recepción</Button>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>

      <FocusModal open={paymentOpen} onOpenChange={setPaymentOpen}>
        <FocusModal.Content className="max-w-lg">
          <FocusModal.Header><Heading level="h2">Registrar abono · {order.number}</Heading></FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6">
            <Text size="small" className="text-ui-fg-subtle">Saldo pendiente: <strong>{money(order.balance)}</strong></Text>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Monto (B/.)</Label><Input type="number" min={0} step="0.01" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} /></div>
              <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Fecha</Label><Input type="date" value={payment.paid_at} onChange={(e) => setPayment({ ...payment, paid_at: e.target.value })} /></div>
              <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Método</Label>
                <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v })}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content>{PAYMENT_METHODS.map((m) => <Select.Item key={m} value={m}>{m}</Select.Item>)}</Select.Content></Select>
              </div>
              <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Referencia</Label><Input placeholder="N.º de transferencia o cheque" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} /></div>
            </div>
            <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Nota</Label><Textarea rows={2} value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} /></div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <Button variant="secondary" type="button" onClick={() => setPaymentOpen(false)}>Cancelar</Button>
            <Button type="button" isLoading={busy === "payment"} onClick={savePayment}>Registrar abono</Button>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </div>
  )
}
