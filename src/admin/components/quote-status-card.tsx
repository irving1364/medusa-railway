import { Badge, Button, Container, Heading, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { STATUS, convertQuote, createQuoteLink, errorMessage, fmtDate, listRevisions, money, setQuoteStatus, type Quote, type QuoteStatus, type Revision } from "../lib/quotes"

interface Props {
  quote: Quote
  dirty: boolean
  version: number
  onChanged: (quote: Quote) => void
  onSend: () => void
}

const ACTION_LABEL: Record<string, string> = { viewed: "El cliente la abrió en línea", "client:accept": "Aprobada por el cliente en línea", "client:changes": "El cliente solicita cambios", "client:reject": "Rechazada por el cliente en línea", converted: "Convertida en pedido", created: "Creada", reopened: "Reabierta para edición", sent: "Enviada por correo", "status:sent": "Marcada como enviada", "status:approved": "Aprobada", "status:rejected": "Rechazada", "status:draft": "Reabierta" }

/** Status, next actions and history of a quote. */
export default function QuoteStatusCard({ quote, dirty, version, onChanged, onSend }: Props) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<Revision[]>([])

  useEffect(() => { listRevisions(quote.id).then(({ revisions }) => setRevisions(revisions)).catch(() => {}) }, [quote.id, version, quote.status])

  const change = async (status: QuoteStatus, label: string) => {
    setBusy(status)
    try {
      const { quote: updated } = await setQuoteStatus(quote.id, status, note.trim() || undefined)
      onChanged(updated)
      setNote("")
      toast.success(label)
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo cambiar el estado"))
    } finally {
      setBusy(null)
    }
  }

  const copyLink = async () => {
    try {
      let url = quote.portal_url
      if (!url) { const { quote: q } = await createQuoteLink(quote.id); onChanged(q); url = q.portal_url }
      if (url) { await navigator.clipboard.writeText(url); toast.success("Enlace copiado: compártalo por WhatsApp o correo") }
    } catch (e) { toast.error(errorMessage(e, "No se pudo crear el enlace")) }
  }
  const convert = async () => {
    if (!window.confirm(`¿Crear el pedido a partir de la cotización ${quote.number}? Se registra en Pedidos con estas líneas y precios.`)) return
    setBusy("convert")
    try { const { quote: q, order } = await convertQuote(quote.id); onChanged(q); toast.success(`Pedido #${order.display_id} creado`) } catch (e) { toast.error(errorMessage(e, "No se pudo crear el pedido")) } finally { setBusy(null) }
  }

  const st = STATUS[quote.effective_status]
  const open = quote.status === "draft" || quote.status === "sent"

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Estado</Heading>
          <Badge size="small" color={st.color}>{st.label}{quote.version > 1 ? ` · v${quote.version}` : ""}</Badge>
        </div>
        <div className="flex flex-col gap-3 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-ui-fg-subtle">Total</span><span className="text-right font-medium">{money(quote.total)}</span>
            <span className="text-ui-fg-subtle">Vence</span><span className="text-right">{fmtDate(quote.valid_until)}</span>
            {quote.sent_at && (<><span className="text-ui-fg-subtle">Enviada</span><span className="text-right">{fmtDate(quote.sent_at, true)}</span></>)}
            {quote.approved_at && (<><span className="text-ui-fg-subtle">Aprobada</span><span className="text-right">{fmtDate(quote.approved_at, true)}</span></>)}
            {quote.rejected_at && (<><span className="text-ui-fg-subtle">Rechazada</span><span className="text-right">{fmtDate(quote.rejected_at, true)}</span></>)}
          </div>
          {quote.status !== "draft" && (
            <div className="flex flex-col gap-1.5 rounded-md bg-ui-bg-subtle p-3">
              <Text size="xsmall" weight="plus">Enlace para el cliente</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">{quote.viewed_at ? `Visto ${quote.view_count} vez${quote.view_count === 1 ? "" : "es"} · primera ${fmtDate(quote.viewed_at, true)}` : "El cliente aún no la ha abierto."}</Text>
              <div className="flex gap-2">
                <Button size="small" variant="secondary" type="button" onClick={copyLink}>Copiar enlace</Button>
                {quote.portal_url && <Button size="small" variant="transparent" asChild><a href={quote.portal_url} target="_blank" rel="noreferrer">Abrir</a></Button>}
              </div>
            </div>
          )}
          {quote.responded_at && (
            <div className="rounded-md border border-ui-border-base p-3">
              <Text size="xsmall" weight="plus">{quote.status === "approved" ? "Aprobada por el cliente" : quote.status === "rejected" ? "Rechazada por el cliente" : "El cliente solicitó cambios"}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">{quote.response_name} · {fmtDate(quote.responded_at, true)}</Text>
              {quote.response_comment && <Text size="xsmall" className="mt-1 whitespace-pre-line">{quote.response_comment}</Text>}
            </div>
          )}
          {quote.order_id ? (
            <Button size="small" variant="secondary" asChild><a href={`/app/orders/${quote.order_id}`}>Ver pedido #{quote.order_display_id}</a></Button>
          ) : quote.status === "approved" ? (
            <Button size="small" type="button" isLoading={busy === "convert"} onClick={convert} disabled={dirty}>Convertir en pedido</Button>
          ) : null}
          {dirty && <Text size="xsmall" className="text-ui-fg-error">Guarde los cambios antes de enviar o cambiar el estado.</Text>}
          {open && <Textarea rows={2} placeholder="Nota para el historial (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />}
          <div className="flex flex-col gap-2">
            {open && <Button size="small" type="button" onClick={onSend} disabled={dirty || !quote.lines.length}>Enviar por correo con PDF</Button>}
            {quote.status === "draft" && <Button size="small" variant="secondary" type="button" isLoading={busy === "sent"} onClick={() => change("sent", "Marcada como enviada")} disabled={dirty || !quote.lines.length}>Marcar como enviada (sin correo)</Button>}
            {open && <Button size="small" variant="secondary" type="button" isLoading={busy === "approved"} onClick={() => change("approved", "Cotización aprobada")} disabled={dirty}>Aprobar</Button>}
            {open && <Button size="small" variant="secondary" type="button" isLoading={busy === "rejected"} onClick={() => change("rejected", "Cotización rechazada")} disabled={dirty}>Rechazar</Button>}
            {!open && !quote.order_id && <Button size="small" variant="secondary" type="button" isLoading={busy === "draft"} onClick={() => change("draft", "Cotización reabierta como borrador")}>Reabrir como borrador</Button>}
            {quote.status === "sent" && <Text size="xsmall" className="text-ui-fg-subtle">Si edita y guarda una cotización enviada, vuelve a borrador como una nueva versión.</Text>}
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Historial</Heading></div>
        <ul className="divide-y divide-ui-border-base">
          {revisions.map((r) => (
            <li key={r.id} className="px-6 py-3">
              <div className="flex items-center justify-between gap-2">
                <Text size="small" weight="plus">{ACTION_LABEL[r.action] || r.action}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">v{r.version}</Text>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">{fmtDate(r.created_at, true)}{r.actor_email ? ` · ${r.actor_email}` : ""}{r.total != null ? ` · ${money(r.total)}` : ""}</Text>
              {r.sent_to && <Text size="xsmall" className="text-ui-fg-subtle">Para: {r.sent_to}</Text>}
              {r.note && <Text size="xsmall" className="mt-1 whitespace-pre-line">{r.note}</Text>}
              {r.pdf_url && <a href={r.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-ui-fg-interactive hover:underline">PDF enviado</a>}
            </li>
          ))}
          {revisions.length === 0 && <li className="px-6 py-3"><Text size="small" className="text-ui-fg-subtle">Sin movimientos.</Text></li>}
        </ul>
      </Container>
    </div>
  )
}
