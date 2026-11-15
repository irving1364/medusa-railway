import { Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { STORES, errorMessage, listProfiles, updateProfile, type QuoteProfile, type QuoteStore } from "../../../lib/quotes"

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

/** /cotizaciones/configuracion — per-store identity, bank details, default texts, numbering and email. */
const QuoteSettingsPage = () => {
  const navigate = useNavigate()
  const [store, setStore] = useState<QuoteStore>("fabmetal")
  const [saved, setSaved] = useState<QuoteProfile[]>([])
  const [value, setValue] = useState<QuoteProfile | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { listProfiles().then(({ profiles }) => { setSaved(profiles); setValue(profiles.find((p) => p.store === "fabmetal") || null) }).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))) }, [])
  const original = saved.find((p) => p.store === store) || null
  const dirty = useMemo(() => !!value && !!original && JSON.stringify(value) !== JSON.stringify(original), [value, original])

  const switchStore = (s: QuoteStore) => { if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cambiar de tienda y descartarlos?")) return; setStore(s); setValue(saved.find((p) => p.store === s) || null) }
  const set = <K extends keyof QuoteProfile>(k: K, v: QuoteProfile[K]) => value && setValue({ ...value, [k]: v })
  const text = (k: keyof QuoteProfile) => ({ value: (value?.[k] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never) })

  const save = async () => {
    if (!value) return
    setBusy(true)
    try {
      const { id: _i, store: _s, ...body } = value
      const { profile } = await updateProfile(store, body)
      setSaved((all) => all.map((p) => (p.store === store ? profile : p)))
      setValue(profile)
      toast.success("Configuración guardada")
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h1">Configuración de cotizaciones</Heading>
          <Text size="small" className="text-ui-fg-subtle">Numeración, impuestos y textos por defecto de cada empresa.</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => navigate("/cotizaciones")}>Volver</Button>
          <Button size="small" isLoading={busy} onClick={save} disabled={!dirty}>Guardar</Button>
        </div>
      </Container>
      <div className="flex gap-1">{STORES.map((s) => <Button key={s.value} size="small" variant={store === s.value ? "primary" : "secondary"} onClick={() => switchStore(s.value)}>{s.label}</Button>)}</div>

      {value && (
        <>
          <Container className="p-6">
            <Text size="small">La identidad (marca, razón social, R.U.C., dirección, logo), los datos bancarios y el remitente de correo se editan en <a href="/app/empresas" className="text-ui-fg-interactive hover:underline">Empresas</a>. Aquí quedan la numeración, los impuestos y los textos por defecto de cada empresa.</Text>
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Textos por defecto</Heading><Text size="small" className="text-ui-fg-subtle">Se copian a cada cotización nueva; allí se pueden ajustar. Una línea por viñeta.</Text></div>
            <div className="grid gap-4 px-6 py-4">
              <Field label="Garantía"><Textarea rows={2} {...text("warranty_text")} /></Field>
              <Field label="Condiciones de pago"><Textarea rows={4} {...text("payment_terms")} /></Field>
              <Field label="Condiciones generales"><Textarea rows={5} {...text("general_terms")} /></Field>
            </div>
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Numeración, impuestos y firma</Heading></div>
            <div className="grid gap-4 px-6 py-4 md:grid-cols-3">
              <Field label="Prefijo" hint="Ej. S → S00249"><Input {...text("number_prefix")} /></Field>
              <Field label="Siguiente número" hint="Para continuar la numeración de Odoo."><Input type="number" min={1} value={value.next_number} onChange={(e) => set("next_number", Number(e.target.value) || 1)} /></Field>
              <Field label="Validez (días)"><Input type="number" min={1} value={value.validity_days} onChange={(e) => set("validity_days", Number(e.target.value) || 30)} /></Field>
              <Field label="ITBMS por defecto (%)"><Input type="number" min={0} step="0.5" value={value.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value) || 0)} /></Field>
              <div className="md:col-span-3"><Field label="Firma del correo (opcional)" hint="Texto al final del mensaje; vacío = marca y contactos."><Textarea rows={3} {...text("email_signature")} /></Field></div>
            </div>
          </Container>
        </>
      )}
    </div>
  )
}

export default QuoteSettingsPage
