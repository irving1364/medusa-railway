import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import PurchaseForm from "../../../components/purchase-form"
import { defaultCompanyCode, getCompany, type CompanyCode } from "../../../lib/companies"
import { createOrder, emptyOrder, errorMessage, listPurchaseProfiles, newLine, toBody, type PurchaseInput, type PurchaseProfile, lineProblem } from "../../../lib/purchases"
import { getOrder as getWorkOrder, type WorkOrder } from "../../../lib/workshop"

/** Draft lines for what a work order still has to buy (shortfall after stock). */
const fromWorkOrder = (wo: WorkOrder, base: PurchaseInput, taxRate: number): PurchaseInput => ({
  ...base,
  company: wo.company,
  notes_internal: `Para la orden de taller ${wo.number} · ${wo.title}`,
  lines: (wo.material_lines || []).filter((m) => m.shortfall > 0).map((m) => newLine({ item_id: m.item_id, ref: m.item_ref, title: m.name, unit: m.unit, quantity: m.shortfall, unit_price: m.last_price || 0, tax_rate: taxRate })),
})

/** /compras/new — the number is assigned on first save. ?taller=<work order id> prefills what that job still needs. */
const NewPurchasePage = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const workOrderId = params.get("taller")
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [profiles, setProfiles] = useState<PurchaseProfile[]>([])
  const [value, setValue] = useState<PurchaseInput>(emptyOrder(defaultCompanyCode(getCompany())))
  const [busy, setBusy] = useState(false)
  const profile = profiles.find((p) => p.company === value.company) || null

  useEffect(() => {
    const initial = defaultCompanyCode(getCompany())
    listPurchaseProfiles().then(async ({ profiles }) => {
      setProfiles(profiles)
      if (workOrderId) {
        try {
          const { order: wo } = await getWorkOrder(workOrderId)
          const p = profiles.find((x) => x.company === wo.company) || null
          setWorkOrder(wo)
          setValue(fromWorkOrder(wo, emptyOrder(wo.company, p), Number(p?.tax_rate ?? 7) || 0))
          return
        } catch { toast.error("No se encontró la orden de taller") }
      }
      setValue(emptyOrder(initial, profiles.find((p) => p.company === initial) || null))
    }).catch(() => {})
  }, [workOrderId])

  const change = (next: PurchaseInput) => {
    if (next.company !== value.company) {
      const p = profiles.find((x) => x.company === next.company) || null
      const blank = emptyOrder(next.company as CompanyCode, p)
      setValue({ ...next, ship_to_name: blank.ship_to_name, ship_to_address: blank.ship_to_address, ship_to_phone: blank.ship_to_phone, payment_terms: value.payment_terms || blank.payment_terms })
      return
    }
    setValue(next)
  }

  const save = async () => {
    if (!value.supplier_name.trim()) { toast.error("Indique el proveedor"); return }
    const problem = lineProblem(value.lines)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try { const { order } = await createOrder({ ...toBody(value), ...(workOrder ? { metadata: { work_order_id: workOrder.id, work_order_number: workOrder.number } } : {}) }); toast.success(`Orden ${order.number} creada`); navigate(`/compras/${order.id}`, { replace: true }) } catch (e) { toast.error(errorMessage(e, "No se pudo crear")) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div><Heading level="h1">Nueva orden de compra</Heading>{workOrder && <Text size="small">Material que falta para <Link className="text-ui-fg-interactive hover:underline" to={`/taller/${workOrder.id}`}>{workOrder.number} · {workOrder.title}</Link>. Elija el proveedor y revise cantidades y precios.</Text>}<Text size="small" className="text-ui-fg-subtle">Siguiente número: {profile ? `${profile.number_prefix}${String(profile.next_number).padStart(5, "0")}` : "…"}</Text></div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => navigate(workOrder ? `/taller/${workOrder.id}` : "/compras")}>Cancelar</Button>
          <Button size="small" isLoading={busy} onClick={save}>Crear borrador</Button>
        </div>
      </Container>
      <PurchaseForm value={value} onChange={change} profile={profile} lockCompany={false} />
    </div>
  )
}

export default NewPurchasePage
