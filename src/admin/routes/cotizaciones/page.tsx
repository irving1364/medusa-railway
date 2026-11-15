import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Select, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { STATUS, STORES, errorMessage, fmtDate, listQuotes, money, storeLabel, type EffectiveStatus, type Quote } from "../../lib/quotes"

type Tab = "all" | EffectiveStatus
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "draft", label: "Borradores" },
  { key: "sent", label: "Enviadas" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "expired", label: "Vencidas" },
]

/** Sales quotations for both stores. */
const QuotesPage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("all")
  const [store, setStore] = useState<string>("all")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Quote[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      listQuotes({ q: q.trim() || undefined, status: tab === "all" ? undefined : tab, store: store === "all" ? undefined : store, limit: 100 })
        .then(({ quotes, count }) => { setRows(quotes); setCount(count) })
        .catch((e) => toast.error(errorMessage(e, "No se pudo cargar la lista")))
        .finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [tab, store, q])

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h1">Cotizaciones</Heading>
          <Text size="small" className="text-ui-fg-subtle">Propuestas comerciales de FABMETAL y KARVEN con PDF y envío por correo.</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => navigate("/cotizaciones/configuracion")}>Configuración</Button>
          <Button size="small" onClick={() => navigate("/cotizaciones/new")}>Nueva cotización</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <div className="flex flex-wrap gap-1">{TABS.map((t) => <Button key={t.key} size="small" variant={tab === t.key ? "primary" : "transparent"} onClick={() => setTab(t.key)}>{t.label}</Button>)}</div>
        <span className="flex-1" />
        <Select value={store} onValueChange={setStore} size="small">
          <Select.Trigger className="w-44"><Select.Value /></Select.Trigger>
          <Select.Content><Select.Item value="all">Ambas tiendas</Select.Item>{STORES.map((s) => <Select.Item key={s.value} value={s.value}>{s.label}</Select.Item>)}</Select.Content>
        </Select>
        <Input size="small" placeholder="Número, cliente o empresa" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Número</Table.HeaderCell>
            <Table.HeaderCell>Cliente</Table.HeaderCell>
            <Table.HeaderCell>Tienda</Table.HeaderCell>
            <Table.HeaderCell>Fecha</Table.HeaderCell>
            <Table.HeaderCell>Vence</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.id} className="cursor-pointer" onClick={() => navigate(`/cotizaciones/${r.id}`)}>
              <Table.Cell><span className="font-mono text-xs">{r.number}</span>{r.version > 1 ? <span className="ml-1 text-xs text-ui-fg-muted">v{r.version}</span> : null}</Table.Cell>
              <Table.Cell><Text size="small" weight="plus" className="truncate">{r.customer_name}</Text>{r.customer_company && <Text size="xsmall" className="truncate text-ui-fg-subtle">{r.customer_company}</Text>}</Table.Cell>
              <Table.Cell>{storeLabel(r.store)}</Table.Cell>
              <Table.Cell>{fmtDate(r.issue_date)}</Table.Cell>
              <Table.Cell>{fmtDate(r.valid_until)}</Table.Cell>
              <Table.Cell className="text-right">{money(r.total)}</Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={STATUS[r.effective_status].color}>{STATUS[r.effective_status].label}</Badge></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!loading && rows.length === 0 && <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">{q ? "Ninguna cotización coincide." : "Todavía no hay cotizaciones. Cree la primera con \"Nueva cotización\"."}</Text></div>}
      <div className="px-6 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{loading ? "Cargando…" : `${count} cotización${count === 1 ? "" : "es"}`}</Text></div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Cotizaciones", icon: DocumentText })

export default QuotesPage
