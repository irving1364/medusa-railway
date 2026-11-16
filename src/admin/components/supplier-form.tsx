import { Input, Label, Text, Textarea } from "@medusajs/ui"
import type { SupplierInput } from "../lib/purchases"

const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}{required && <span className="text-ui-fg-error"> *</span>}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

/** Supplier (proveedor) fields: identity, contact, address and usual payment terms. */
export default function SupplierForm({ value, onChange }: { value: SupplierInput; onChange: (next: SupplierInput) => void }) {
  const text = (k: keyof SupplierInput) => ({ value: value[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value }) })
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Field label="Razón social / nombre" required hint="Tal como saldrá en la orden de compra."><Input placeholder="Hopsa, S.A." {...text("name")} /></Field></div>
      <Field label="R.U.C."><Input placeholder="20697911751271" {...text("ruc")} /></Field>
      <Field label="DV"><Input placeholder="00" {...text("dv")} /></Field>
      <Field label="Persona de contacto"><Input placeholder="Vendedor asignado" {...text("contact_name")} /></Field>
      <Field label="Teléfono / WhatsApp"><Input placeholder="+507 6998-6119" {...text("phone")} /></Field>
      <Field label="Correo" hint="Destinatario por defecto al enviar la orden."><Input type="email" placeholder="ventas@proveedor.com" {...text("email")} /></Field>
      <Field label="Dirección"><Input placeholder="Ave. Transístmica y Calle 64 Oeste, Panamá" {...text("address")} /></Field>
      <div className="md:col-span-2"><Field label="Términos de pago habituales" hint="Se copian a cada orden nueva de este proveedor."><Textarea rows={2} placeholder="Contado · 30 días · 50% anticipo…" {...text("payment_terms")} /></Field></div>
      <div className="md:col-span-2"><Field label="Notas internas"><Textarea rows={2} {...text("notes")} /></Field></div>
    </div>
  )
}
