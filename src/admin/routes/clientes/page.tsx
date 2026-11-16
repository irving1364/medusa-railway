import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Users } from "@medusajs/icons"
import type { HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { customerName, customerType, errorMessage, fiscalId, listCustomers } from "../../lib/customers"

/** Customers as the sales team uses them: person or company, contact, sector, fiscal id. Built on Medusa's native customers. */
const CustomersPage = () => {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<HttpTypes.AdminCustomer[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      listCustomers({ q: q.trim() || undefined, limit: 100 })
        .then(({ customers, count }) => { setRows(customers); setCount(count) })
        .catch((e) => toast.error(errorMessage(e, "No se pudo cargar la lista")))
        .finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h1">Clientes</Heading>
          <Text size="small" className="text-ui-fg-subtle">Personas y empresas a las que se cotiza. Los mismos registros aparecen en Customers y en los pedidos.</Text>
        </div>
        <Button size="small" onClick={() => navigate("/clientes/new")}>Nuevo cliente</Button>
      </div>
      <div className="flex items-center gap-2 px-6 py-3">
        <Input size="small" placeholder="Nombre, empresa, correo o teléfono" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Cliente</Table.HeaderCell>
            <Table.HeaderCell>Tipo</Table.HeaderCell>
            <Table.HeaderCell>Contacto</Table.HeaderCell>
            <Table.HeaderCell>Sector</Table.HeaderCell>
            <Table.HeaderCell>RUC / Cédula</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((c) => {
            const m = (c.metadata || {}) as Record<string, unknown>
            const type = customerType(c)
            const contact = type === "company" ? [c.first_name, c.last_name].filter(Boolean).join(" ") : ""
            return (
              <Table.Row key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                <Table.Cell><Text size="small" weight="plus">{customerName(c)}</Text>{contact && <Text size="xsmall" className="text-ui-fg-subtle">{contact}</Text>}</Table.Cell>
                <Table.Cell><Badge size="2xsmall" color={type === "company" ? "blue" : "grey"}>{type === "company" ? "Empresa" : "Persona"}</Badge></Table.Cell>
                <Table.Cell><Text size="small">{c.phone || ""}</Text><Text size="xsmall" className="text-ui-fg-subtle">{c.email || ""}</Text></Table.Cell>
                <Table.Cell>{(m.sector as string) || <span className="text-ui-fg-muted">—</span>}</Table.Cell>
                <Table.Cell>{fiscalId(c) || <span className="text-ui-fg-muted">—</span>}</Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
      {!loading && rows.length === 0 && <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">{q ? "Ningún cliente coincide." : "Todavía no hay clientes. Cree el primero con \"Nuevo cliente\"."}</Text></div>}
      <div className="px-6 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{loading ? "Cargando…" : `${count} cliente${count === 1 ? "" : "s"}`}</Text></div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Clientes", icon: Users })

export default CustomersPage
