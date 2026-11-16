import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import PurchaseForm from "../../../components/purchase-form"
import { defaultCompanyCode, getCompany, type CompanyCode } from "../../../lib/companies"
import { createOrder, emptyOrder, errorMessage, listPurchaseProfiles, toBody, type PurchaseInput, type PurchaseProfile } from "../../../lib/purchases"

/** /compras/new — the number is assigned on first save. */
const NewPurchasePage = () => {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<PurchaseProfile[]>([])
  const [value, setValue] = useState<PurchaseInput>(emptyOrder(defaultCompanyCode(getCompany())))
  const [busy, setBusy] = useState(false)
  const profile = profiles.find((p) => p.company === value.company) || null

  useEffect(() => {
    const initial = defaultCompanyCode(getCompany())
    listPurchaseProfiles().then(({ profiles }) => { setProfiles(profiles); setValue(emptyOrder(initial, profiles.find((p) => p.company === initial) || null)) }).catch(() => {})
  }, [])

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
    setBusy(true)
    try { const { order } = await createOrder(toBody(value)); toast.success(`Orden ${order.number} creada`); navigate(`/compras/${order.id}`, { replace: true }) } catch (e) { toast.error(errorMessage(e, "No se pudo crear")) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div><Heading level="h1">Nueva orden de compra</Heading><Text size="small" className="text-ui-fg-subtle">Siguiente número: {profile ? `${profile.number_prefix}${String(profile.next_number).padStart(5, "0")}` : "…"}</Text></div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => navigate("/compras")}>Cancelar</Button>
          <Button size="small" isLoading={busy} onClick={save}>Crear borrador</Button>
        </div>
      </Container>
      <PurchaseForm value={value} onChange={change} profile={profile} lockCompany={false} />
    </div>
  )
}

export default NewPurchasePage
