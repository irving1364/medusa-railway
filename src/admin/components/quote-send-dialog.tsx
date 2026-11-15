import { Button, FocusModal, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { errorMessage, fmtDate, money, sendQuote, type Quote, type QuoteProfile } from "../lib/quotes"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote
  profile: QuoteProfile | null
  onSent: (quote: Quote) => void
}

const splitEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)

/** Email the quote with the PDF attached. Subject and message are prefilled and editable. */
export default function QuoteSendDialog({ open, onOpenChange, quote, profile, onSent }: Props) {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const brand = profile?.brand_line?.split("|")[0].trim() || "FABMETAL"
    setTo(quote.customer_email || "")
    setCc("")
    setSubject(`Cotización ${quote.number}${quote.version > 1 ? ` (v${quote.version})` : ""} · ${brand}`)
    setMessage(`Estimado/a ${quote.contact_name || quote.customer_name}:\n\nAdjuntamos la cotización ${quote.number} por un total de ${money(quote.total)} (ITBMS incluido), válida hasta el ${fmtDate(quote.valid_until)}.\n\nQuedamos atentos a cualquier consulta o ajuste que necesite.\n\nSaludos cordiales,\n${brand}`)
  }, [open, quote, profile])

  const send = async () => {
    const toList = splitEmails(to)
    if (!toList.length) { toast.error("Indique al menos un destinatario"); return }
    setBusy(true)
    try {
      const { quote: updated } = await sendQuote(quote.id, { to: toList, cc: splitEmails(cc), subject: subject.trim(), message })
      toast.success(`Cotización enviada a ${toList.join(", ")}`)
      onSent(updated)
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo enviar"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-2xl">
        <FocusModal.Header><Heading level="h2">Enviar cotización {quote.number}</Heading></FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Para</Label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="cliente@correo.com, otro@correo.com" /></div>
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Copia (opcional)</Label><Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="ventas@fabmetal.com.pa" />{profile?.cc_email && <Text size="xsmall" className="text-ui-fg-subtle">Siempre se copia a {profile.cc_email}.</Text>}</div>
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Asunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">Mensaje</Label><Textarea rows={9} value={message} onChange={(e) => setMessage(e.target.value)} /><Text size="xsmall" className="text-ui-fg-subtle">El PDF se adjunta automáticamente y se guarda una copia en el historial. La cotización pasa a "Enviada".</Text></div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" isLoading={busy} onClick={send}>Enviar con PDF adjunto</Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}
