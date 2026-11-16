import { Badge, Button, IconButton, Input, Select, Text, Textarea, Tooltip, toast } from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import { useEffect, useRef, useState } from "react"
import { UNITS, createItem, lineAmount, lineFromItem, listItems, money, newLine, totalsOf, type PurchaseItem, type PurchaseLine } from "../lib/purchases"

interface Props { lines: PurchaseLine[]; taxRate: number; onChange: (lines: PurchaseLine[]) => void; disabled?: boolean; showReceived?: boolean }

/** Purchase order lines: pick from the materials catalogue (last price prefilled), add free lines, or create the material on the fly. */
export default function PurchaseLines({ lines, taxRate, onChange, disabled, showReceived }: Props) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<PurchaseItem[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => listItems(q.trim(), true).then(({ items }) => { setResults(items); setOpen(true) }).catch(() => setResults([])).finally(() => setSearching(false)), 250)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => { const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close) }, [])

  const add = (line: PurchaseLine) => { onChange([...lines, line]); setQ(""); setOpen(false) }
  const createAndAdd = async () => {
    const name = q.trim()
    if (!name) return
    try { const { item } = await createItem({ name, ref: "", description: "", unit: "Unidades", category: "", last_price: "" }); add(lineFromItem(item, taxRate)); toast.success(`"${name}" agregado al catálogo de materiales`) } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo crear el material") }
  }
  const set = (i: number, patch: Partial<PurchaseLine>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= lines.length) return; const next = [...lines]; ;[next[i], next[j]] = [next[j], next[i]]; onChange(next) }
  const remove = (i: number) => onChange(lines.filter((_, k) => k !== i))
  const totals = totalsOf(lines)
  const num = (v: number) => (Number.isFinite(v) ? String(v) : "")

  return (
    <div className="flex flex-col gap-4">
      {!disabled && (
        <div ref={box} className="relative">
          <div className="flex gap-2">
            <Input size="small" placeholder="Buscar material por nombre, referencia o categoría…" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} />
            <Button size="small" variant="secondary" type="button" onClick={() => add(newLine({ tax_rate: taxRate }))}><Plus /> Línea libre</Button>
          </div>
          {open && (q.trim() || searching) && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
              {searching && !results.length && <Text size="small" className="p-3 text-ui-fg-subtle">Buscando…</Text>}
              {results.map((it) => (
                <button key={it.id} type="button" onClick={() => add(lineFromItem(it, taxRate))} className="flex w-full items-center gap-3 border-b border-ui-border-base px-3 py-2 text-left last:border-b-0 hover:bg-ui-bg-subtle">
                  <div className="min-w-0 flex-1">
                    <Text size="small" weight="plus" className="truncate">{it.ref ? <span className="mr-1 font-mono text-[11px] text-ui-fg-muted">[{it.ref}]</span> : null}{it.name}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">{[it.category, it.unit, it.last_price != null ? `último precio ${money(Number(it.last_price))}${it.last_supplier_name ? ` (${it.last_supplier_name})` : ""}` : null].filter(Boolean).join(" · ")}</Text>
                  </div>
                </button>
              ))}
              {!searching && q.trim() && (
                <button type="button" onClick={createAndAdd} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ui-fg-interactive hover:bg-ui-bg-subtle"><Plus /> Crear material "{q.trim()}" y agregarlo</button>
              )}
            </div>
          )}
        </div>
      )}

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ui-border-base p-6 text-center"><Text size="small" className="text-ui-fg-subtle">Sin líneas. Busque un material del catálogo o agregue una línea libre.</Text></div>
      ) : (
        <ol className="flex flex-col gap-3">
          {lines.map((l, i) => (
            <li key={l.id} className="rounded-lg border border-ui-border-base p-3">
              <div className="grid gap-2 md:grid-cols-[8rem_1fr_auto]">
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Referencia</Text><Input size="small" value={l.ref || ""} onChange={(e) => set(i, { ref: e.target.value || null })} placeholder="26451830" disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Material / servicio</Text><Input size="small" value={l.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="LAMINA DE ACERO INOXIDABLE CALIBRE 18…" disabled={disabled} /></div>
                <div className="flex items-end gap-1">
                  <Tooltip content="Subir"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0}><ArrowUpMini /></IconButton></Tooltip>
                  <Tooltip content="Bajar"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, 1)} disabled={disabled || i === lines.length - 1}><ArrowDownMini /></IconButton></Tooltip>
                  <Tooltip content="Quitar"><IconButton size="small" variant="transparent" type="button" onClick={() => remove(i)} disabled={disabled || l.received_qty > 0}><Trash /></IconButton></Tooltip>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Cantidad</Text><Input size="small" type="number" min={0} step="0.01" value={num(l.quantity)} onChange={(e) => set(i, { quantity: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Unidad</Text>
                  <Select value={UNITS.includes(l.unit) ? l.unit : "__other"} onValueChange={(v) => set(i, { unit: v === "__other" ? l.unit : v })} disabled={disabled} size="small">
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>{UNITS.map((u) => <Select.Item key={u} value={u}>{u}</Select.Item>)}{!UNITS.includes(l.unit) && <Select.Item value="__other">{l.unit}</Select.Item>}</Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Precio unitario</Text><Input size="small" type="number" min={0} step="0.01" value={num(l.unit_price)} onChange={(e) => set(i, { unit_price: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Desc. %</Text><Input size="small" type="number" min={0} max={100} step="0.5" value={num(l.discount_pct)} onChange={(e) => set(i, { discount_pct: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">ITBMS %</Text><Input size="small" type="number" min={0} max={100} step="0.5" value={num(l.tax_rate)} onChange={(e) => set(i, { tax_rate: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1 text-right"><Text size="xsmall" className="text-ui-fg-subtle">Importe</Text><Text size="small" weight="plus" className="pt-1.5">{money(lineAmount(l))}</Text></div>
              </div>
              <div className="mt-2 flex items-start gap-2">
                <div className="flex flex-1 flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Descripción (opcional, sale bajo la línea en el PDF)</Text><Textarea rows={2} value={l.description || ""} onChange={(e) => set(i, { description: e.target.value || null })} disabled={disabled} /></div>
                {showReceived && <div className="pt-5"><Badge size="2xsmall" color={l.received_qty >= l.quantity && l.quantity > 0 ? "green" : l.received_qty > 0 ? "orange" : "grey"}>Recibido {l.received_qty} / {l.quantity}</Badge></div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="ml-auto w-full max-w-xs rounded-lg border border-ui-border-base text-sm">
        <div className="flex justify-between px-3 py-1.5"><span className="text-ui-fg-subtle">Subtotal</span><span>{money(totals.subtotal)}</span></div>
        {totals.discount_total > 0 && <div className="flex justify-between px-3 py-1.5"><span className="text-ui-fg-subtle">Descuentos</span><span>-{money(totals.discount_total)}</span></div>}
        <div className="flex justify-between border-t border-ui-border-base px-3 py-1.5"><span className="text-ui-fg-subtle">ITBMS</span><span>{money(totals.tax_total)}</span></div>
        <div className="flex justify-between border-t border-ui-border-base px-3 py-2 font-medium"><span>Total</span><span>{money(totals.total)}</span></div>
      </div>
    </div>
  )
}
