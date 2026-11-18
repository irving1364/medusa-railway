import { Badge, Button, Container, Heading, Prompt, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import QuoteForm from "../../../components/quote-form"
import QuoteSendDialog from "../../../components/quote-send-dialog"
import QuoteStatusCard from "../../../components/quote-status-card"
import { STATUS, deleteQuote, duplicateQuote, errorMessage, getQuote, listProfiles, quotePdfUrl, storeLabel, toBody, toInput, updateQuote, type Quote, type QuoteInput, type QuoteProfile, lineProblem } from "../../../lib/quotes"

/** /cotizaciones/:id — edit, preview PDF, send, change status, duplicate, delete. */
const EditQuotePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [value, setValue] = useState<QuoteInput | null>(null)
  const [profile, setProfile] = useState<QuoteProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const [sendOpen, setSendOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getQuote(id).then(({ quote }) => { setQuote(quote); setValue(toInput(quote)); listProfiles().then(({ profiles }) => setProfile(profiles.find((p) => p.store === quote.store) || null)).catch(() => {}) }).catch((e) => setError(errorMessage(e, "Cotización no encontrada")))
  }, [id])

  const dirty = useMemo(() => !!quote && !!value && JSON.stringify(toInput(quote)) !== JSON.stringify(value), [quote, value])
  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", onLeave)
    return () => window.removeEventListener("beforeunload", onLeave)
  }, [dirty])

  const apply = (q: Quote) => { setQuote(q); setValue(toInput(q)); setVersion((n) => n + 1) }

  const save = async () => {
    if (!quote || !value) return
    if (!value.customer_name.trim()) { toast.error("Escriba el nombre del cliente"); return }
    const problem = lineProblem(value.lines)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try {
      const { quote: updated } = await updateQuote(quote.id, toBody(value))
      apply(updated)
      toast.success(updated.version > quote.version ? `Guardada como versión ${updated.version} (vuelve a borrador)` : "Cambios guardados")
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar"))
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async () => {
    if (!quote) return
    try { const { quote: copy } = await duplicateQuote(quote.id); toast.success(`Creada ${copy.number} a partir de ${quote.number}`); navigate(`/cotizaciones/${copy.id}`) } catch (e) { toast.error(errorMessage(e, "No se pudo duplicar")) }
  }

  if (error) return <Container><Text>{error}</Text></Container>
  if (!quote || !value) return <Container><Text size="small" className="text-ui-fg-subtle">Cargando…</Text></Container>
  const closed = quote.status === "approved" || quote.status === "rejected"
  const st = STATUS[quote.effective_status]

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h1">Cotización {quote.number}</Heading>
            <Badge size="2xsmall" color={st.color}>{st.label}</Badge>
            <Badge size="2xsmall" color="grey">{storeLabel(quote.store)}</Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">{dirty ? "Cambios sin guardar" : closed ? "Cerrada: reábrala para editar el contenido" : `${quote.customer_name} · versión ${quote.version}`}</Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" asChild><a href={quotePdfUrl(quote.id)} target="_blank" rel="noreferrer">Ver PDF</a></Button>
          <Button size="small" variant="secondary" onClick={duplicate}>Duplicar</Button>
          <Button size="small" variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/cotizaciones")}>Volver</Button>
          <Button size="small" isLoading={busy} onClick={save} disabled={!dirty}>Guardar</Button>
        </div>
      </Container>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <QuoteForm value={value} onChange={setValue} profile={profile} lockStore disabled={closed} />
        <QuoteStatusCard quote={quote} dirty={dirty} version={version} onChanged={apply} onSend={() => setSendOpen(true)} />
      </div>

      <QuoteSendDialog open={sendOpen} onOpenChange={setSendOpen} quote={quote} profile={profile} onSent={apply} />

      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar la cotización {quote.number}</Prompt.Title>
            <Prompt.Description>Desaparece de la lista y su número no se reutiliza. Si solo quiere cerrarla, use "Rechazar".</Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={async () => { try { await deleteQuote(quote.id); toast.success("Cotización eliminada"); navigate("/cotizaciones") } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) } }}>Eliminar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}

export default EditQuotePage
