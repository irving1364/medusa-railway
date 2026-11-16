import { Button, FocusModal, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { errorMessage, fmtDate, money, sendOrder, type PurchaseOrder } from "../lib/purchases"
import type { Company } from "../lib/companies"

interface Props { open: boolean; onOpenChange: (o: boolean) => void; order: PurchaseOrder; company: Company | null; onSent: (o: PurchaseOrder) => void }
const splitEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)

/** Email the purchase order (PDF attached) to the supplier. */
export default function PurchaseSendDialog({ open, onOpenChange, order, company, onSent }: Props) {
  const [to, setTo] = useState(""); const [cc, setCc] = useState(""); const [subject, setSubject] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    const buyer = company?.name || "FABMETAL"
    setTo(order.supplier_email || ""); setCc("")
    setSubject(`Orden de compra ${order.number} · ${buyer}`)
    setMessage(`Estimados ${order.supplier_contact || order.supplier_name}:\n\nAdjuntamos la orden de compra ${order.number} por un total de ${money(order.total)} (ITBMS incluido)${order.expected_date ? `, con llegada esperada el ${fmtDate(order.expected_date)}` : ""}.\n\nAgradecemos confirmar recepción y fecha de entrega.\n\nSaludos cordiales,\n${buyer}`)
  }, [open, order, company])
  const send = async () => {
    const toList = splitEmails(to)
    if (!toList.length) { toast.error("Indique al menos un destinatario"); return }
    setBusy(true)
    try { const { order: updated } = await sendOrder(order.id, { to: toList, cc: splitEmails(cc), subject: subject.trim(), message }); toast.success(`Orden enviada a ${toList.join(", ")}`); onSent(updated); onOpenChange(false) } catch (e) { toast.error(errorMessage(e, "No se pudo enviar")) } finally { setBusy(false) }
  }
  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-2xl">
        <FocusModal.Header><Heading level="h2">Enviar orden {order.number} al proveedor</Heading></FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Para</Label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="ventas@proveedor.com" /></div>
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Copia (opcional)</Label><Input value={cc} onChange={(e) => setCc(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Asunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Mensaje</Label><Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} /><Text size="xsmall" className="text-ui-fg-subtle">El PDF se adjunta y se guarda una copia en el historial. Un borrador pasa a "Enviada".</Text></div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" isLoading={busy} onClick={send}>Enviar con PDF adjunto</Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
