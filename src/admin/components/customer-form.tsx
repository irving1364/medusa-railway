import { Badge, Input, Label, Select, Text, Textarea } from "@medusajs/ui"
import { ChevronDownMini, ChevronUpMini } from "@medusajs/icons"
import { useState } from "react"
import { PROVINCES, SECTORS, type CustomerInput, type CustomerType } from "../lib/customers"

interface Props {
  value: CustomerInput
  onChange: (next: CustomerInput) => void
}

const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}{required && <span className="text-ui-fg-error"> *</span>}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

/** Customer form from the client's mock-up: type, name/contact, phone or email, sector, province and optional fiscal data. */
export default function CustomerForm({ value, onChange }: Props) {
  const [fiscalOpen, setFiscalOpen] = useState(!!(value.ruc || value.fiscal_address || value.district))
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => onChange({ ...value, [k]: v })
  const text = (k: keyof CustomerInput) => ({ value: value[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never) })
  const company = value.type === "company"

  return (
    <div className="flex flex-col gap-5">
      <Field label="Tipo de cliente" required>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-ui-bg-subtle p-1">
          {([["person", "Persona natural"], ["company", "Empresa o institución"]] as [CustomerType, string][]).map(([t, label]) => (
            <button key={t} type="button" onClick={() => set("type", t)} className={`rounded-md px-3 py-2 text-sm transition-colors ${value.type === t ? "bg-ui-bg-base font-medium shadow-elevation-card-rest" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>{label}</button>
          ))}
        </div>
      </Field>

      <Field label={company ? "Nombre de empresa o institución" : "Nombre completo"} required hint="Este nombre aparecerá en la cotización.">
        <Input placeholder={company ? "CANYFELVET S.A." : "Dra. María Pérez"} {...text("name")} />
      </Field>
      {company && (
        <Field label="Persona de contacto (opcional)"><Input placeholder="Dr. Abel" {...text("contact")} /></Field>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Teléfono / WhatsApp"><Input placeholder="6000-0000" inputMode="tel" {...text("phone")} /></Field>
        <Field label="Correo electrónico"><Input type="email" placeholder="correo@empresa.com" {...text("email")} /></Field>
      </div>
      <Text size="xsmall" className="-mt-3 text-ui-fg-subtle">Debe completarse al menos uno de los dos medios de contacto.</Text>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sector (opcional)">
          <Select value={value.sector || "__none"} onValueChange={(v) => set("sector", v === "__none" ? "" : v)}>
            <Select.Trigger><Select.Value placeholder="Seleccionar" /></Select.Trigger>
            <Select.Content><Select.Item value="__none">Sin especificar</Select.Item>{SECTORS.map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}</Select.Content>
          </Select>
        </Field>
        <Field label="Provincia (opcional)">
          <Select value={value.province || "__none"} onValueChange={(v) => set("province", v === "__none" ? "" : v)}>
            <Select.Trigger><Select.Value placeholder="Seleccionar" /></Select.Trigger>
            <Select.Content><Select.Item value="__none">Sin especificar</Select.Item>{PROVINCES.map((p) => <Select.Item key={p} value={p}>{p}</Select.Item>)}</Select.Content>
          </Select>
        </Field>
      </div>

      <div className="border-t border-ui-border-base pt-4">
        <button type="button" onClick={() => setFiscalOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
          <Text size="small" weight="plus">Datos fiscales y de facturación</Text>
          <Badge size="2xsmall" color="grey">Opcional</Badge>
          <span className="flex-1" />
          {fiscalOpen ? <ChevronUpMini className="text-ui-fg-muted" /> : <ChevronDownMini className="text-ui-fg-muted" />}
        </button>
        {fiscalOpen && (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_8rem]">
            <Field label="RUC / Cédula"><Input placeholder="Identificación fiscal" {...text("ruc")} /></Field>
            <Field label="DV (si aplica)"><Input placeholder="00" {...text("dv")} /></Field>
            <div className="md:col-span-2"><Field label="Dirección fiscal"><Input placeholder="Dirección para facturación" {...text("fiscal_address")} /></Field></div>
            <div className="md:col-span-2"><Field label="Distrito y corregimiento"><Input placeholder="Ubicación fiscal" {...text("district")} /></Field></div>
            <div className="md:col-span-2"><Field label="Notas internas (opcional)"><Textarea rows={2} placeholder="Condiciones acordadas, horario de contacto…" {...text("notes")} /></Field></div>
          </div>
        )}
      </div>
      <Text size="xsmall" className="text-ui-fg-error">* Campos obligatorios</Text>
    </div>
  )
}
