import { Badge, Input, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/sdk"

interface Props {
  ids: string[]
  onChange: (ids: string[]) => void
}

type Lite = { id: string; title: string; thumbnail?: string | null }

/** Picks catalogue products shown as "Mobiliario utilizado" on the project page. */
export default function ProductPicker({ ids, onChange }: Props) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Lite[]>([])
  const [selected, setSelected] = useState<Lite[]>([])

  useEffect(() => {
    if (!ids.length) { setSelected([]); return }
    sdk.admin.product.list({ id: ids, limit: ids.length, fields: "id,title,thumbnail" })
      .then(({ products }) => setSelected(ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Lite[]))
      .catch(() => {})
  }, [ids.join(",")])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      sdk.admin.product.list({ q: term, limit: 8, fields: "id,title,thumbnail" })
        .then(({ products }) => setResults(products.filter((p) => !ids.includes(p.id)) as Lite[]))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q, ids.join(",")])

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <Badge key={p.id} size="small" className="flex items-center gap-2 pr-1">
              {p.thumbnail && <img src={p.thumbnail} alt="" className="h-5 w-5 rounded object-cover" />}
              {p.title}
              <button type="button" className="ml-1 rounded px-1 text-ui-fg-subtle hover:text-ui-fg-base" onClick={() => onChange(ids.filter((x) => x !== p.id))} aria-label={`Quitar ${p.title}`}>×</button>
            </Badge>
          ))}
        </div>
      )}
      <Input size="small" placeholder="Buscar producto del catálogo..." value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="divide-y rounded-md border border-ui-border-base">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-subtle" onClick={() => { onChange([...ids, p.id]); setQ(""); setResults([]) }}>
                {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="h-8 w-8 rounded bg-ui-bg-subtle" />}
                <Text size="small">{p.title}</Text>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
