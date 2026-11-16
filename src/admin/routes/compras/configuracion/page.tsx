import { Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { STORES } from "../../../lib/quotes"
import type { CompanyCode } from "../../../lib/companies"
import { errorMessage, listPurchaseProfiles, updatePurchaseProfile, type PurchaseProfile } from "../../../lib/purchases"

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5"><Label size="small" weight="plus">{label}</Label>{children}{hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}</div>
)

/** /compras/configuracion — numbering, default ship-to address, payment terms and tax per company. */
const PurchaseSettingsPage = () => {
  const navigate = useNavigate()
  const [company, setCompany] = useState<CompanyCode>("fabmetal")
  const [saved, setSaved] = useState<PurchaseProfile[]>([])
  const [value, setValue] = useState<PurchaseProfile | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { listPurchaseProfiles().then(({ profiles }) => { setSaved(profiles); setValue(profiles.find((p) => p.company === "fabmetal") || null) }).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))) }, [])
  const original = saved.find((p) => p.company === company) || null
  const dirty = useMemo(() => !!value && !!original && JSON.stringify(value) !== JSON.stringify(original), [value, original])
  const pick = (c: CompanyCode) => { if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cambiar de empresa y descartarlos?")) return; setCompany(c); setValue(saved.find((p) => p.company === c) || null) }
  const set = <K extends keyof PurchaseProfile>(k: K, v: PurchaseProfile[K]) => value && setValue({ ...value, [k]: v })
  const text = (k: keyof PurchaseProfile) => ({ value: (value?.[k] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never) })

  const save = async () => {
    if (!value) return
    setBusy(true)
    try { const { id: _i, company: _c, ...body } = value; const { profile } = await updatePurchaseProfile(company, body); setSaved((all) => all.map((p) => (p.company === company ? profile : p))); setValue(profile); toast.success("Configuración guardada") } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div><Heading level="h1">Configuración de compras</Heading><Text size="small" className="text-ui-fg-subtle">Numeración, dirección de envío por defecto, términos de pago e ITBMS por empresa. La identidad del PDF viene de Empresas.</Text></div>
        <div className="flex gap-2"><Button size="small" variant="secondary" onClick={() => navigate("/compras")}>Volver</Button><Button size="small" isLoading={busy} onClick={save} disabled={!dirty}>Guardar</Button></div>
      </Container>
      <div className="flex gap-1">{STORES.map((s) => <Button key={s.value} size="small" variant={company === s.value ? "primary" : "secondary"} onClick={() => pick(s.value)}>{s.label}</Button>)}</div>
      {value && (
        <>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Numeración e impuestos</Heading></div>
            <div className="grid gap-4 px-6 py-4 md:grid-cols-3">
              <Field label="Prefijo" hint="Ej. P → P00017"><Input {...text("number_prefix")} /></Field>
              <Field label="Siguiente número" hint="Para continuar la numeración de Odoo."><Input type="number" min={1} value={value.next_number} onChange={(e) => set("next_number", Number(e.target.value) || 1)} /></Field>
              <Field label="ITBMS por defecto (%)"><Input type="number" min={0} step="0.5" value={value.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value) || 0)} /></Field>
            </div>
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Dirección de envío por defecto</Heading></div>
            <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
              <Field label="Nombre"><Input {...text("ship_to_name")} /></Field>
              <Field label="Teléfono de recepción"><Input {...text("ship_to_phone")} /></Field>
              <div className="md:col-span-2"><Field label="Dirección"><Input {...text("ship_to_address")} /></Field></div>
            </div>
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Textos por defecto</Heading></div>
            <div className="grid gap-4 px-6 py-4">
              <Field label="Términos de pago" hint="Se copian a cada orden nueva si el proveedor no tiene los suyos."><Textarea rows={3} {...text("payment_terms")} /></Field>
              <Field label="Firma del correo (opcional)"><Textarea rows={3} {...text("email_signature")} /></Field>
            </div>
          </Container>
        </>
      )}
    </div>
  )
}

export default PurchaseSettingsPage
