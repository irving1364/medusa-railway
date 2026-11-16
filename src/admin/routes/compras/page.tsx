import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import CompanySwitcher from "../../components/company-switcher"
import { companyColor, companyLabel, useCompany } from "../../lib/companies"
import { STATUS, errorMessage, fmtDate, listOrders, money, type PurchaseOrder, type PurchaseStatus } from "../../lib/purchases"

type Tab = "all" | PurchaseStatus | "pending_payment"
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todas" }, { key: "draft", label: "Borradores" }, { key: "sent", label: "Enviadas" }, { key: "confirmed", label: "Confirmadas" },
  { key: "partial", label: "Recibidas parcial" }, { key: "received", label: "Recibidas" }, { key: "pending_payment", label: "Con saldo" }, { key: "cancelled", label: "Canceladas" },
]

/** Purchase orders to suppliers, per company. */
const PurchasesPage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<PurchaseOrder[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [company] = useCompany()

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      listOrders({ q: q.trim() || undefined, status: tab === "all" ? undefined : tab, company: company === "all" ? undefined : company, limit: 100 })
        .then(({ orders, count }) => { setRows(orders); setCount(count) })
        .catch((e) => toast.error(errorMessage(e, "No se pudo cargar la lista")))
        .finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [tab, q, company])

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h1">Compras</Heading>
          <Text size="small" className="text-ui-fg-subtle">Órdenes de compra a proveedores, con recepción de mercancía y registro de abonos.</Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySwitcher compact />
          <Button size="small" variant="secondary" onClick={() => navigate("/compras/proveedores")}>Proveedores</Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/compras/materiales")}>Materiales</Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/compras/configuracion")}>Configuración</Button>
          <Button size="small" onClick={() => navigate("/compras/new")}>Nueva orden</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <div className="flex flex-wrap gap-1">{TABS.map((t) => <Button key={t.key} size="small" variant={tab === t.key ? "primary" : "transparent"} onClick={() => setTab(t.key)}>{t.label}</Button>)}</div>
        <span className="flex-1" />
        <Input size="small" placeholder="Número, proveedor o factura" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Número</Table.HeaderCell>
            <Table.HeaderCell>Proveedor</Table.HeaderCell>
            <Table.HeaderCell>Empresa</Table.HeaderCell>
            <Table.HeaderCell>Fecha</Table.HeaderCell>
            <Table.HeaderCell>Llegada</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
            <Table.HeaderCell className="text-right">Saldo</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((o) => (
            <Table.Row key={o.id} className="cursor-pointer" onClick={() => navigate(`/compras/${o.id}`)}>
              <Table.Cell><span className="font-mono text-xs">{o.number}</span></Table.Cell>
              <Table.Cell><Text size="small" weight="plus" className="truncate">{o.supplier_name}</Text>{o.invoice_reference && <Text size="xsmall" className="text-ui-fg-subtle">Fact. {o.invoice_reference}</Text>}</Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={companyColor(o.company)}>{companyLabel(o.company)}</Badge></Table.Cell>
              <Table.Cell>{fmtDate(o.order_date)}</Table.Cell>
              <Table.Cell>{fmtDate(o.expected_date)}</Table.Cell>
              <Table.Cell className="text-right">{money(o.total)}</Table.Cell>
              <Table.Cell className={`text-right ${o.balance > 0 && o.status !== "cancelled" ? "text-ui-fg-error" : ""}`}>{o.status === "cancelled" ? "—" : money(o.balance)}</Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={STATUS[o.status].color}>{STATUS[o.status].label}</Badge></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!loading && rows.length === 0 && <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">{q ? "Ninguna orden coincide." : "Todavía no hay órdenes de compra. Cree la primera con \"Nueva orden\"."}</Text></div>}
      <div className="px-6 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{loading ? "Cargando…" : `${count} orden${count === 1 ? "" : "es"}`}</Text></div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Compras", icon: ShoppingBag })

export default PurchasesPage
