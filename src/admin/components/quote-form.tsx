import type { HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, Container, FocusModal, Heading, Input, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { STORES, addDaysISO, searchCustomers, type QuoteInput, type QuoteProfile } from "../lib/quotes"
import { createCustomer, customerName, emptyCustomer, quoteFieldsFrom, toPayload as customerPayload, validate as validateCustomer, type CustomerInput } from "../lib/customers"
import CustomerForm from "./customer-form"
import QuoteLines from "./quote-lines"

interface Props {
  value: QuoteInput
  onChange: (next: QuoteInput) => void
  profile: QuoteProfile | null
  /** Store cannot change after the number is assigned */
  lockStore: boolean
  disabled?: boolean
}

const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}{required && <span className="text-ui-fg-error"> *</span>}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

/** Customer, dates, lines and the text blocks of a quote. */
export default function QuoteForm({ value, onChange, profile, lockStore, disabled }: Props) {
  const set = <K extends keyof QuoteInput>(key: K, v: QuoteInput[K]) => onChange({ ...value, [key]: v })
  const text = (key: keyof QuoteInput) => ({ value: (value[key] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never), disabled })

  const [custQ, setCustQ] = useState("")
  const [custResults, setCustResults] = useState<HttpTypes.AdminCustomer[]>([])
  const [custOpen, setCustOpen] = useState(false)
  const custBox = useRef<HTMLDivElement>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState<CustomerInput>(emptyCustomer())
  const [newBusy, setNewBusy] = useState(false)
  useEffect(() => {
    if (!custQ.trim()) { setCustResults([]); return }
    const t = setTimeout(() => searchCustomers(custQ.trim()).then((r) => { setCustResults(r); setCustOpen(true) }).catch(() => setCustResults([])), 250)
    return () => clearTimeout(t)
  }, [custQ])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (custBox.current && !custBox.current.contains(e.target as Node)) setCustOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  const pickCustomer = (c: HttpTypes.AdminCustomer) => {
    onChange({ ...value, ...quoteFieldsFrom(c) })
    setCustQ(""); setCustOpen(false)
  }
  const saveNewCustomer = async () => {
    const problem = validateCustomer(newCustomer)
    if (problem) { toast.error(problem); return }
    setNewBusy(true)
    try {
      const { customer } = await createCustomer(customerPayload(newCustomer))
      pickCustomer(customer)
      setNewOpen(false)
      setNewCustomer(emptyCustomer())
      toast.success(`Cliente ${customerName(customer)} guardado y cargado en la cotización`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el cliente")
    } finally {
      setNewBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4"><Heading level="h2">Cliente</Heading>{value.customer_id && <Badge size="2xsmall" color="blue">Cliente de Medusa</Badge>}</div>
        <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
          {!disabled && (
            <div ref={custBox} className="relative md:col-span-2">
              <div className="flex gap-2">
                <Input size="small" placeholder="Buscar cliente registrado (nombre, empresa o correo)…" value={custQ} onChange={(e) => setCustQ(e.target.value)} onFocus={() => custResults.length && setCustOpen(true)} />
                <Button size="small" variant="secondary" type="button" onClick={() => { setNewCustomer({ ...emptyCustomer(), name: custQ.trim() }); setNewOpen(true) }}>Nuevo cliente</Button>
              </div>
              {custOpen && custResults.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
                  {custResults.map((c) => (
                    <li key={c.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-ui-bg-subtle" onClick={() => pickCustomer(c)}>{c.company_name ? `${c.company_name} · ` : ""}{[c.first_name, c.last_name].filter(Boolean).join(" ")} <span className="text-ui-fg-subtle">{c.email}</span></button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Field label="Cliente" required hint="Nombre de la empresa o de la persona, tal como saldrá en el PDF."><Input placeholder="Cliente Regular" {...text("customer_name")} /></Field>
          {!disabled && (
            <FocusModal open={newOpen} onOpenChange={setNewOpen}>
              <FocusModal.Content className="max-w-2xl">
                <FocusModal.Header><Heading level="h2">Nuevo cliente · alta rápida</Heading></FocusModal.Header>
                <FocusModal.Body className="overflow-y-auto p-6"><CustomerForm value={newCustomer} onChange={setNewCustomer} /></FocusModal.Body>
                <FocusModal.Footer>
                  <Button variant="secondary" type="button" onClick={() => setNewCustomer(emptyCustomer())}>Limpiar</Button>
                  <Button variant="secondary" type="button" onClick={() => setNewOpen(false)}>Cancelar</Button>
                  <Button type="button" isLoading={newBusy} onClick={saveNewCustomer}>Guardar cliente</Button>
                </FocusModal.Footer>
              </FocusModal.Content>
            </FocusModal>
          )}
          <Field label="Empresa (si el cliente es una persona)"><Input placeholder="Clínica…" {...text("customer_company")} /></Field>
          <Field label="R.U.C. / cédula"><Input placeholder="8-123-456" {...text("customer_ruc")} /></Field>
          <Field label="Persona de contacto"><Input placeholder="Nombre de quien recibe la cotización" {...text("contact_name")} /></Field>
          <Field label="Correo" hint="Destinatario por defecto al enviar."><Input type="email" placeholder="cliente@correo.com" {...text("customer_email")} /></Field>
          <Field label="Teléfono / WhatsApp"><Input placeholder="6000-0000" {...text("customer_phone")} /></Field>
          <div className="md:col-span-2"><Field label="Dirección"><Input placeholder="Ciudad de Panamá" {...text("customer_address")} /></Field></div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Datos de la cotización</Heading></div>
        <div className="grid gap-4 px-6 py-4 md:grid-cols-4">
          <Field label="Tienda" hint={lockStore ? "Define el número y la plantilla; no cambia tras crearla." : "Define numeración, plantilla y datos legales."}>
            <Select value={value.store} onValueChange={(v) => set("store", v as QuoteInput["store"])} disabled={lockStore || disabled}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{STORES.map((s) => <Select.Item key={s.value} value={s.value}>{s.label}</Select.Item>)}</Select.Content>
            </Select>
          </Field>
          <Field label="Fecha"><Input type="date" value={value.issue_date} onChange={(e) => onChange({ ...value, issue_date: e.target.value, valid_until: e.target.value ? addDaysISO(e.target.value, profile?.validity_days || 30) : value.valid_until })} disabled={disabled} /></Field>
          <Field label="Vencimiento"><Input type="date" value={value.valid_until} onChange={(e) => set("valid_until", e.target.value)} disabled={disabled} /></Field>
          <Field label="Vendedor" hint="Vacío = nombre de la tienda."><Input placeholder="FABMETAL" {...text("salesperson")} /></Field>
          <div className="md:col-span-4"><Field label="Texto introductorio (opcional)" hint="Aparece encima de la tabla de productos."><Textarea rows={2} placeholder="Atendiendo a su solicitud, presentamos la siguiente propuesta…" {...text("intro_text")} /></Field></div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Productos y servicios</Heading><Text size="small" className="text-ui-fg-subtle">Desde el catálogo (referencia, descripción y precio precargados) o líneas libres para trabajos a medida.</Text></div>
        <div className="px-6 py-4"><QuoteLines lines={value.lines} taxRate={profile?.tax_rate ?? 7} onChange={(lines) => set("lines", lines)} disabled={disabled} /></div>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div><Heading level="h2">Condiciones</Heading><Text size="small" className="text-ui-fg-subtle">Precargadas desde la configuración de la tienda; una línea por viñeta.</Text></div>
          {profile && !disabled && <Button size="small" variant="transparent" type="button" onClick={() => onChange({ ...value, warranty_text: profile.warranty_text || "", payment_terms: profile.payment_terms || "", general_terms: profile.general_terms || "" })}>Restaurar textos de la tienda</Button>}
        </div>
        <div className="grid gap-4 px-6 py-4">
          <Field label="Garantía"><Textarea rows={2} {...text("warranty_text")} /></Field>
          <Field label="Condiciones de pago"><Textarea rows={4} {...text("payment_terms")} /></Field>
          <Field label="Condiciones generales"><Textarea rows={5} {...text("general_terms")} /></Field>
          <Field label="Notas internas" hint="No salen en el PDF ni en el correo."><Textarea rows={2} placeholder="Margen, proveedor, acuerdos verbales…" value={value.notes_internal} onChange={(e) => set("notes_internal", e.target.value)} /></Field>
        </div>
      </Container>
    </div>
  )
}
