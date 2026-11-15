import type { HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, IconButton, Input, Text, Textarea, Tooltip } from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import { useEffect, useRef, useState } from "react"
import { lineAmount, lineFromProduct, money, newLine, searchProducts, totalsOf, type QuoteLine } from "../lib/quotes"

interface Props {
  lines: QuoteLine[]
  taxRate: number
  onChange: (lines: QuoteLine[]) => void
  disabled?: boolean
}

/** Quote lines: catalogue picker (product + size) or free lines; quantity, unit, price, discount, tax and a technical description. */
export default function QuoteLines({ lines, taxRate, onChange, disabled }: Props) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<HttpTypes.AdminProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(() => searchProducts(q.trim()).then((r) => { setResults(r); setOpen(true) }).catch(() => setResults([])).finally(() => setSearching(false)), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  const add = (line: QuoteLine) => { onChange([...lines, line]); setQ(""); setOpen(false) }
  const set = (i: number, patch: Partial<QuoteLine>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= lines.length) return; const next = [...lines]; ;[next[i], next[j]] = [next[j], next[i]]; onChange(next) }
  const remove = (i: number) => onChange(lines.filter((_, k) => k !== i))
  const totals = totalsOf(lines)
  const num = (v: number) => (Number.isFinite(v) ? String(v) : "")

  return (
    <div className="flex flex-col gap-4">
      {!disabled && (
        <div ref={box} className="relative">
          <div className="flex gap-2">
            <Input size="small" placeholder="Buscar en el catálogo por nombre o referencia…" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} />
            <Button size="small" variant="secondary" type="button" onClick={() => add(newLine({ tax_rate: taxRate }))}><Plus /> Línea libre</Button>
          </div>
          {open && (q.trim() || searching) && (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
              {searching && !results.length && <Text size="small" className="p-3 text-ui-fg-subtle">Buscando…</Text>}
              {!searching && !results.length && <Text size="small" className="p-3 text-ui-fg-subtle">Sin resultados. Puede agregar una línea libre.</Text>}
              {results.map((p) => (
                <div key={p.id} className="border-b border-ui-border-base last:border-b-0">
                  <div className="flex items-center gap-3 px-3 pt-2">
                    <div className="h-9 w-11 shrink-0 overflow-hidden rounded bg-white">{p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-contain" /> : null}</div>
                    <Text size="small" weight="plus" className="truncate">{p.title}</Text>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1.5">
                    {(p.variants || []).map((v) => {
                      const price = (v.prices || []).find((pr) => pr.currency_code === "pab")?.amount ?? (v.prices || [])[0]?.amount
                      return (
                        <button key={v.id} type="button" onClick={() => add(lineFromProduct(p, v, taxRate))} className="rounded-full border border-ui-border-base px-2.5 py-1 text-xs hover:bg-ui-bg-subtle">
                          {v.title}{v.sku ? <span className="ml-1 font-mono text-[10px] text-ui-fg-muted">{v.sku}</span> : null}{price != null ? <span className="ml-1 text-ui-fg-subtle">· {money(Number(price))}</span> : null}
                        </button>
                      )
                    })}
                    {!(p.variants || []).length && <button type="button" onClick={() => add(lineFromProduct(p, undefined, taxRate))} className="rounded-full border border-ui-border-base px-2.5 py-1 text-xs hover:bg-ui-bg-subtle">Agregar</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ui-border-base p-6 text-center"><Text size="small" className="text-ui-fg-subtle">Sin líneas. Busque un producto del catálogo o agregue una línea libre.</Text></div>
      ) : (
        <ol className="flex flex-col gap-3">
          {lines.map((l, i) => (
            <li key={l.id} className="rounded-lg border border-ui-border-base p-3">
              <div className="grid gap-2 md:grid-cols-[7rem_1fr_auto]">
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">Referencia</Text>
                  <Input size="small" value={l.ref || ""} onChange={(e) => set(i, { ref: e.target.value || null })} placeholder="FM-MES-…" disabled={disabled} />
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">Producto</Text>
                  <Input size="small" value={l.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Mesa de trabajo inoxidable" disabled={disabled} />
                </div>
                <div className="flex items-end gap-1">
                  <Tooltip content="Subir"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0}><ArrowUpMini /></IconButton></Tooltip>
                  <Tooltip content="Bajar"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, 1)} disabled={disabled || i === lines.length - 1}><ArrowDownMini /></IconButton></Tooltip>
                  <Tooltip content="Quitar"><IconButton size="small" variant="transparent" type="button" onClick={() => remove(i)} disabled={disabled}><Trash /></IconButton></Tooltip>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Cantidad</Text><Input size="small" type="number" min={0} step="0.01" value={num(l.quantity)} onChange={(e) => set(i, { quantity: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Unidad</Text><Input size="small" value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Precio unitario</Text><Input size="small" type="number" min={0} step="0.01" value={num(l.unit_price)} onChange={(e) => set(i, { unit_price: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">Descuento %</Text><Input size="small" type="number" min={0} max={100} step="0.5" value={num(l.discount_pct)} onChange={(e) => set(i, { discount_pct: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1"><Text size="xsmall" className="text-ui-fg-subtle">ITBMS %</Text><Input size="small" type="number" min={0} max={100} step="0.5" value={num(l.tax_rate)} onChange={(e) => set(i, { tax_rate: Number(e.target.value) })} disabled={disabled} /></div>
                <div className="flex flex-col gap-1 text-right"><Text size="xsmall" className="text-ui-fg-subtle">Importe</Text><Text size="small" weight="plus" className="pt-1.5">{money(lineAmount(l))}</Text></div>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">Descripción técnica (sale en el PDF bajo la línea)</Text>
                <Textarea rows={3} value={l.description || ""} onChange={(e) => set(i, { description: e.target.value || null })} placeholder="Fabricada en acero inoxidable 304, calibre 18… Medidas: 150 × 60 × 80 cm. No incluye: …" disabled={disabled} />
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
      {lines.length > 0 && <Badge size="2xsmall" color="grey" className="self-end">{lines.length} línea{lines.length === 1 ? "" : "s"}</Badge>}
    </div>
  )
}
