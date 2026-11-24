import type { HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, IconButton, Input, Label, Select, Text, Textarea } from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { customerName } from "../lib/customers"
import { searchCustomers } from "../lib/quotes"
import { COMPANY_LABEL } from "../lib/companies"
import { ACTIVITY_TEMPLATES, MATERIALS_LABEL, PRIORITY_LABEL, TYPE_LABEL, type ActivityInput, type Materials, type OrderInput, type Priority, type Resource, type WorkType } from "../lib/workshop"

export const Field = ({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}{required && <span className="text-ui-fg-error"> *</span>}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

const NONE = "__none"

/** Client name with an optional link to a registered customer (Clientes). Typing a new name keeps it as free text. */
export function CustomerField({ name, customerId, onChange }: { name: string; customerId: string; onChange: (name: string, customerId: string) => void }) {
  const [results, setResults] = useState<HttpTypes.AdminCustomer[]>([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => searchCustomers(q.trim()).then((r) => { setResults(r); setOpen(true) }).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  return (
    <div ref={box} className="relative flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label size="small" weight="plus">Cliente</Label>
        {customerId && <Badge size="2xsmall" color="blue">Cliente registrado</Badge>}
        {customerId && <button type="button" className="txt-compact-xsmall text-ui-fg-subtle hover:underline" onClick={() => onChange(name, "")}>Quitar vínculo</button>}
      </div>
      <Input placeholder="Buscar cliente registrado o escribir el nombre" value={name} onChange={(e) => { onChange(e.target.value, customerId); if (!customerId) setQ(e.target.value) }} onFocus={() => results.length && setOpen(true)} />
      {open && results.length > 0 && !customerId && (
        <ul className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
          {results.map((c) => (
            <li key={c.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-ui-bg-subtle" onClick={() => { onChange(customerName(c), c.id); setOpen(false); setResults([]) }}>{customerName(c)} <span className="text-ui-fg-subtle">{c.email}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Picker of the workshop people. "" = nobody. */
export const ResourceSelect = ({ value, onChange, resources, placeholder = "Sin asignar", size = "base" }: { value: string | null; onChange: (v: string) => void; resources: Resource[]; placeholder?: string; size?: "small" | "base" }) => (
  <Select size={size} value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
    <Select.Trigger><Select.Value placeholder={placeholder} /></Select.Trigger>
    <Select.Content>
      <Select.Item value={NONE}>{placeholder}</Select.Item>
      {resources.filter((r) => r.active || r.id === value).map((r) => <Select.Item key={r.id} value={r.id}>{r.name}{r.role ? ` · ${r.role}` : ""}</Select.Item>)}
    </Select.Content>
  </Select>
)

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Record<T, string> }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <Select.Trigger><Select.Value /></Select.Trigger>
      <Select.Content>{(Object.keys(options) as T[]).map((k) => <Select.Item key={k} value={k}>{options[k]}</Select.Item>)}</Select.Content>
    </Select>
  )
}

/** Data of the work order. `creating` unlocks the type (the number depends on it) and shows the initial operations. */
export default function WorkOrderForm({ value, onChange, resources, creating, activities, onActivities, materialsLocked }: {
  value: OrderInput
  onChange: (v: OrderInput) => void
  resources: Resource[]
  creating?: boolean
  activities?: ActivityInput[]
  onActivities?: (a: ActivityInput[]) => void
  /** The order has material lines: the state is computed from them. */
  materialsLocked?: boolean
}) {
  const set = <K extends keyof OrderInput>(k: K, v: OrderInput[K]) => onChange({ ...value, [k]: v })
  const text = (k: keyof OrderInput) => ({ value: String(value[k] ?? ""), onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) })
  const setType = (t: WorkType) => {
    onChange({ ...value, type: t })
    if (onActivities && activities && activities.every((a, i) => a.name === ACTIVITY_TEMPLATES[value.type][i]?.name)) onActivities(ACTIVITY_TEMPLATES[t].map((a) => ({ ...a, date: null, resource_id: null })))
  }
  const acts = activities || []
  const setAct = (i: number, patch: Partial<ActivityInput>) => onActivities?.(acts.map((a, j) => (j === i ? { ...a, ...patch } : a)))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo de trabajo" required hint={creating ? (value.type === "fabrication" ? "Se numera como OP-… (orden de producción)" : "Se numera como OT-… (orden de trabajo)") : "El tipo no cambia una vez creada la orden."}>
          {creating ? <Choice value={value.type} onChange={setType} options={TYPE_LABEL} /> : <Input value={TYPE_LABEL[value.type]} disabled />}
        </Field>
        <Field label="Empresa" required>
          <Choice value={value.company} onChange={(v) => set("company", v)} options={{ fabmetal: COMPANY_LABEL.fabmetal, karven: COMPANY_LABEL.karven }} />
        </Field>
        <div className="md:col-span-2"><Field label="Trabajo" required><Input placeholder="Ej. Mesa de Mayo con base en U" {...text("title")} /></Field></div>
        <CustomerField name={value.client_name} customerId={value.customer_id} onChange={(client_name, customer_id) => onChange({ ...value, client_name, customer_id })} />
        <Field label="Cotización (opcional)"><Input placeholder="Ej. K00042" {...text("quote_number")} /></Field>
        <Field label="Cantidad"><Input type="number" min={1} value={value.quantity} onChange={(e) => set("quantity", Math.max(1, Number(e.target.value) || 1))} /></Field>
        <Field label="Prioridad"><Choice<Priority> value={value.priority} onChange={(v) => set("priority", v)} options={PRIORITY_LABEL} /></Field>
        <Field label="Entrega comprometida" hint="La fecha prometida al cliente."><Input type="date" {...text("due_date")} /></Field>
        <Field label="Terminación interna" hint="Meta del taller, con margen para inspección."><Input type="date" {...text("finish_date")} /></Field>
        <Field label="Responsable"><ResourceSelect value={value.owner_id} onChange={(v) => set("owner_id", v)} resources={resources} /></Field>
        <Field label="Materiales" hint={materialsLocked ? "Se calcula con la lista de materiales de la orden." : undefined}>{materialsLocked ? <Input value={MATERIALS_LABEL[value.materials]} disabled /> : <Choice<Materials> value={value.materials} onChange={(v) => set("materials", v)} options={MATERIALS_LABEL} />}</Field>
        {value.materials !== "complete" && !materialsLocked && <div className="md:col-span-2"><Field label="Qué falta"><Input placeholder="Ej. 2 láminas 304 cal. 16, ruedas con freno" {...text("materials_note")} /></Field></div>}
        <div className="md:col-span-2"><Field label="Descripción y especificaciones"><Textarea rows={3} placeholder="Medidas, configuración, acabados, observaciones del cliente…" {...text("description")} /></Field></div>
        <div className="md:col-span-2"><Field label="Siguiente acción"><Input placeholder="Ej. Verificar materiales y doblar bandeja" {...text("next_action")} /></Field></div>
      </div>

      {creating && onActivities && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label size="small" weight="plus">Operaciones</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">Secuencia de trabajo con horas estimadas. Se programan después en el planificador.</Text>
            </div>
            <Button size="small" variant="secondary" type="button" onClick={() => onActivities([...acts, { name: "", hours: 1, date: null, resource_id: null }])}>Añadir</Button>
          </div>
          {acts.length === 0 && <Text size="small" className="text-ui-fg-subtle">Sin operaciones. Puede añadirlas después.</Text>}
          {acts.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_32px] items-center gap-2 sm:grid-cols-[1fr_200px_80px_32px]">
              <Input size="small" placeholder="Operación" value={a.name} onChange={(e) => setAct(i, { name: e.target.value })} />
              <div className="hidden sm:block"><ResourceSelect size="small" value={a.resource_id} onChange={(v) => setAct(i, { resource_id: v || null })} resources={resources} /></div>
              <Input size="small" type="number" min={0.25} step={0.25} value={a.hours} onChange={(e) => setAct(i, { hours: Number(e.target.value) || 0 })} aria-label="Horas" />
              <IconButton size="small" variant="transparent" type="button" onClick={() => onActivities(acts.filter((_, j) => j !== i))} aria-label="Quitar"><Trash /></IconButton>
            </div>
          ))}
          {acts.length > 0 && <Text size="xsmall" className="text-ui-fg-subtle">Total estimado: {acts.reduce((s, a) => s + (Number(a.hours) || 0), 0)} h</Text>}
        </div>
      )}
    </div>
  )
}
