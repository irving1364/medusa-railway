import { Badge, Button, Container, FocusModal, Heading, Input, Label, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { STORES } from "../lib/quotes"
import { createSupplier, emptySupplier, errorMessage, listSuppliers, supplierFields, type PurchaseInput, type PurchaseProfile, type Supplier, type SupplierInput } from "../lib/purchases"
import PurchaseLines from "./purchase-lines"
import SupplierForm from "./supplier-form"

interface Props { value: PurchaseInput; onChange: (next: PurchaseInput) => void; profile: PurchaseProfile | null; lockCompany: boolean; disabled?: boolean; showReceived?: boolean }

const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}{required && <span className="text-ui-fg-error"> *</span>}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

/** Supplier, ship-to, dates, lines, terms and notes of a purchase order. */
export default function PurchaseForm({ value, onChange, profile, lockCompany, disabled, showReceived }: Props) {
  const set = <K extends keyof PurchaseInput>(k: K, v: PurchaseInput[K]) => onChange({ ...value, [k]: v })
  const text = (k: keyof PurchaseInput) => ({ value: (value[k] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never), disabled })

  const [q, setQ] = useState(""); const [results, setResults] = useState<Supplier[]>([]); const [open, setOpen] = useState(false); const box = useRef<HTMLDivElement>(null)
  const [newOpen, setNewOpen] = useState(false); const [newSupplier, setNewSupplier] = useState<SupplierInput>(emptySupplier()); const [newBusy, setNewBusy] = useState(false)
  useEffect(() => { if (!q.trim()) { setResults([]); return }; const t = setTimeout(() => listSuppliers(q.trim(), true).then(({ suppliers }) => { setResults(suppliers); setOpen(true) }).catch(() => setResults([])), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close) }, [])

  const pick = (s: Supplier) => { onChange({ ...value, ...supplierFields(s), payment_terms: value.payment_terms || s.payment_terms || "" }); setQ(""); setOpen(false) }
  const saveNew = async () => {
    if (!newSupplier.name.trim()) { toast.error("Escriba el nombre del proveedor"); return }
    setNewBusy(true)
    try { const { supplier } = await createSupplier(newSupplier); pick(supplier); setNewOpen(false); setNewSupplier(emptySupplier()); toast.success(`Proveedor ${supplier.name} guardado y cargado`) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar el proveedor")) } finally { setNewBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4"><Heading level="h2">Proveedor</Heading>{value.supplier_id && <Badge size="2xsmall" color="blue">Proveedor registrado</Badge>}</div>
        <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
          {!disabled && (
            <div ref={box} className="relative md:col-span-2">
              <div className="flex gap-2">
                <Input size="small" placeholder="Buscar proveedor registrado (nombre, RUC, contacto)…" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} />
                <Button size="small" variant="secondary" type="button" onClick={() => { setNewSupplier({ ...emptySupplier(), name: q.trim() }); setNewOpen(true) }}>Nuevo proveedor</Button>
              </div>
              {open && results.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
                  {results.map((s) => <li key={s.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-ui-bg-subtle" onClick={() => pick(s)}>{s.name}{s.ruc ? <span className="ml-2 text-ui-fg-subtle">RUC {s.ruc}</span> : null}{s.contact_name ? <span className="ml-2 text-ui-fg-subtle">· {s.contact_name}</span> : null}</button></li>)}
                </ul>
              )}
            </div>
          )}
          <div className="md:col-span-2"><Field label="Proveedor" required hint="Razón social tal como saldrá en la orden."><Input placeholder="Hopsa, S.A." {...text("supplier_name")} /></Field></div>
          <Field label="R.U.C."><Input placeholder="20697911751271" {...text("supplier_ruc")} /></Field>
          <Field label="Persona de contacto"><Input {...text("supplier_contact")} /></Field>
          <Field label="Teléfono"><Input placeholder="+507 6998-6119" {...text("supplier_phone")} /></Field>
          <Field label="Correo" hint="Destinatario por defecto al enviar."><Input type="email" {...text("supplier_email")} /></Field>
          <div className="md:col-span-2"><Field label="Dirección"><Input placeholder="Ave. Transístmica y Calle 64 Oeste, Panamá" {...text("supplier_address")} /></Field></div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Datos de la orden</Heading></div>
        <div className="grid gap-4 px-6 py-4 md:grid-cols-4">
          <Field label="Empresa compradora" hint={lockCompany ? "No cambia tras crearla." : "Define numeración y datos de la cabecera."}>
            <Select value={value.company} onValueChange={(v) => set("company", v as PurchaseInput["company"])} disabled={lockCompany || disabled}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>{STORES.map((s) => <Select.Item key={s.value} value={s.value}>{s.label}</Select.Item>)}</Select.Content>
            </Select>
          </Field>
          <Field label="Fecha de la orden"><Input type="date" value={value.order_date} onChange={(e) => set("order_date", e.target.value)} disabled={disabled} /></Field>
          <Field label="Llegada esperada"><Input type="date" value={value.expected_date} onChange={(e) => set("expected_date", e.target.value)} /></Field>
          <Field label="Factura / remisión del proveedor" hint="Se completa al recibir."><Input placeholder="F-000123" value={value.invoice_reference} onChange={(e) => set("invoice_reference", e.target.value)} /></Field>
          <div className="md:col-span-2"><Field label="Enviar a (nombre)"><Input {...text("ship_to_name")} /></Field></div>
          <div className="md:col-span-2"><Field label="Teléfono de recepción"><Input {...text("ship_to_phone")} /></Field></div>
          <div className="md:col-span-4"><Field label="Dirección de envío" hint={profile ? "Precargada desde la configuración de compras." : undefined}><Input {...text("ship_to_address")} /></Field></div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Materiales y servicios</Heading><Text size="small" className="text-ui-fg-subtle">Del catálogo de materiales (con el último precio pagado) o líneas libres. Un material nuevo se puede crear desde el buscador.</Text></div>
        <div className="px-6 py-4"><PurchaseLines lines={value.lines} taxRate={profile?.tax_rate ?? 7} onChange={(lines) => set("lines", lines)} disabled={disabled} showReceived={showReceived} /></div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Términos y notas</Heading></div>
        <div className="grid gap-4 px-6 py-4">
          <Field label="Términos de pago" hint="Salen en el PDF. Una línea por condición."><Textarea rows={3} placeholder="50% anticipo, 50% contra entrega" value={value.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} /></Field>
          <Field label="Notas internas" hint="No salen en el PDF ni en el correo."><Textarea rows={2} value={value.notes_internal} onChange={(e) => set("notes_internal", e.target.value)} /></Field>
        </div>
      </Container>

      <FocusModal open={newOpen} onOpenChange={setNewOpen}>
        <FocusModal.Content className="max-w-2xl">
          <FocusModal.Header><Heading level="h2">Nuevo proveedor</Heading></FocusModal.Header>
          <FocusModal.Body className="overflow-y-auto p-6"><SupplierForm value={newSupplier} onChange={setNewSupplier} /></FocusModal.Body>
          <FocusModal.Footer>
            <Button variant="secondary" type="button" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button type="button" isLoading={newBusy} onClick={saveNew}>Guardar proveedor</Button>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </div>
  )
}
