import { Badge, Button, Container, Heading, Prompt, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import PurchaseForm from "../../../components/purchase-form"
import PurchaseSendDialog from "../../../components/purchase-send-dialog"
import PurchaseStatusCard from "../../../components/purchase-status-card"
import { companyColor, companyLabel, listCompanies, type Company } from "../../../lib/companies"
import { STATUS, deleteOrder, duplicateOrder, errorMessage, getOrder, listPurchaseProfiles, orderPdfUrl, toBody, toInput, updateOrder, type Payment, type PurchaseEvent, type PurchaseInput, type PurchaseOrder, type PurchaseProfile, type Receipt, lineProblem } from "../../../lib/purchases"

/** /compras/:id — edit, PDF, send, confirm, receive, pay, history. */
const EditPurchasePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [events, setEvents] = useState<PurchaseEvent[]>([])
  const [value, setValue] = useState<PurchaseInput | null>(null)
  const [profile, setProfile] = useState<PurchaseProfile | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return
    getOrder(id).then(({ order, receipts, payments, events }) => {
      setOrder(order); setValue(toInput(order)); setReceipts(receipts); setPayments(payments); setEvents(events)
      listPurchaseProfiles().then(({ profiles }) => setProfile(profiles.find((p) => p.company === order.company) || null)).catch(() => {})
      listCompanies().then(({ companies }) => setCompany(companies.find((c) => c.code === order.company) || null)).catch(() => {})
    }).catch((e) => setError(errorMessage(e, "Orden no encontrada")))
  }, [id])
  useEffect(() => { load() }, [load])

  const dirty = useMemo(() => !!order && !!value && JSON.stringify(toInput(order)) !== JSON.stringify(value), [order, value])
  useEffect(() => { if (!dirty) return; const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload", onLeave); return () => window.removeEventListener("beforeunload", onLeave) }, [dirty])

  const apply = (o: PurchaseOrder) => { setOrder(o); setValue(toInput(o)) }
  const save = async () => {
    if (!order || !value) return
    if (!value.supplier_name.trim()) { toast.error("Indique el proveedor"); return }
    const problem = lineProblem(value.lines)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try { const { order: updated } = await updateOrder(order.id, toBody(value)); apply(updated); toast.success("Cambios guardados"); load() } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }
  const duplicate = async () => { if (!order) return; try { const { order: copy } = await duplicateOrder(order.id); toast.success(`Creada ${copy.number} a partir de ${order.number}`); navigate(`/compras/${copy.id}`) } catch (e) { toast.error(errorMessage(e, "No se pudo duplicar")) } }

  if (error) return <Container><Text>{error}</Text></Container>
  if (!order || !value) return <Container><Text size="small" className="text-ui-fg-subtle">Cargando…</Text></Container>
  const locked = order.status === "received" || order.status === "cancelled"
  const st = STATUS[order.status]

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h1">Orden de compra {order.number}</Heading>
            <Badge size="2xsmall" color={st.color}>{st.label}</Badge>
            <Badge size="2xsmall" color={companyColor(order.company)}>{companyLabel(order.company)}</Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">{dirty ? "Cambios sin guardar" : locked ? "Cerrada: solo se editan notas, fecha de llegada, términos y factura" : order.supplier_name}</Text>
          {typeof order.metadata?.work_order_id === "string" && <Text size="small">Para la orden de taller <Link className="text-ui-fg-interactive hover:underline" to={`/taller/${order.metadata.work_order_id}`}>{String(order.metadata.work_order_number || "ver orden")}</Link></Text>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" asChild><a href={orderPdfUrl(order.id)} target="_blank" rel="noreferrer">Ver PDF</a></Button>
          <Button size="small" variant="secondary" onClick={duplicate}>Duplicar</Button>
          <Button size="small" variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/compras")}>Volver</Button>
          <Button size="small" isLoading={busy} onClick={save} disabled={!dirty}>Guardar</Button>
        </div>
      </Container>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <PurchaseForm value={value} onChange={setValue} profile={profile} lockCompany disabled={locked} showReceived={order.status !== "draft"} />
        <PurchaseStatusCard order={order} receipts={receipts} payments={payments} events={events} dirty={dirty} onChanged={apply} onReload={load} onSend={() => setSendOpen(true)} />
      </div>

      <PurchaseSendDialog open={sendOpen} onOpenChange={setSendOpen} order={order} company={company} onSent={(o) => { apply(o); load() }} />

      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header><Prompt.Title>Eliminar la orden {order.number}</Prompt.Title><Prompt.Description>Desaparece de la lista y su número no se reutiliza. Si ya tiene recepciones o abonos, considere cancelarla en lugar de eliminarla para conservar el historial a la vista.</Prompt.Description></Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={async () => { try { await deleteOrder(order.id); toast.success("Orden eliminada"); navigate("/compras") } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) } }}>Eliminar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}

export default EditPurchasePage
