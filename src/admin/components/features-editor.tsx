import { Button, IconButton, Input, Text, Tooltip } from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from "@medusajs/icons"
import { useState } from "react"

interface Props {
  value: string[]
  onChange: (next: string[]) => void
}

/** Ordered list of short technical features: add, edit in place, remove, move up/down. */
export default function FeaturesEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...value, v])
    setDraft("")
  }
  const edit = (i: number, v: string) => onChange(value.map((f, k) => (k === i ? v : f)))
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && <Text size="xsmall" className="text-ui-fg-subtle">Sin características todavía. Recomendado: entre 3 y 6 principales.</Text>}
      <ol className="flex flex-col gap-1.5">
        {value.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-right font-mono text-[11px] text-ui-fg-muted">{String(i + 1).padStart(2, "0")}</span>
            <Input size="small" value={f} onChange={(e) => edit(i, e.target.value)} onBlur={() => { if (!f.trim()) remove(i) }} />
            <Tooltip content="Subir"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUpMini /></IconButton></Tooltip>
            <Tooltip content="Bajar"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1}><ArrowDownMini /></IconButton></Tooltip>
            <Tooltip content="Eliminar"><IconButton size="small" variant="transparent" type="button" onClick={() => remove(i)}><Trash /></IconButton></Tooltip>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-1.5">
        <span className="w-6 shrink-0" />
        <Input size="small" placeholder="Ej. Base con ruedas, dos con freno" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }} />
        <Button size="small" variant="secondary" type="button" onClick={add} disabled={!draft.trim()}><Plus /> Agregar característica</Button>
      </div>
      <Text size="xsmall" className="text-ui-fg-subtle">Agregue solo características confirmadas del modelo. El material no hace falta repetirlo.</Text>
    </div>
  )
}
