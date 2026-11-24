import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { STAGE_LABEL, TYPE_LABEL, fmtDay, listOrders, stageColor, type WorkOrder } from "../lib/workshop"

/** Work orders of a customer (fabrication, repairs, maintenance): the equipment history seen from Clientes. */
export default function CustomerWorkOrders({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<WorkOrder[] | null>(null)
  useEffect(() => { listOrders({ customer_id: customerId }).then(({ orders }) => setOrders(orders)).catch(() => setOrders([])) }, [customerId])
  if (!orders || orders.length === 0) return null
  const sorted = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <Container className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><Heading level="h2">Órdenes de taller</Heading><Badge size="2xsmall">{orders.length}</Badge></div>
      <div className="grid gap-2 md:grid-cols-2">
        {sorted.map((o) => (
          <Link key={o.id} to={`/taller/${o.id}`} className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base px-3 py-2 hover:bg-ui-bg-base-hover">
            <div className="min-w-0">
              <Text size="small" weight="plus" className="truncate">{o.number} · {o.title}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">{TYPE_LABEL[o.type]}{o.quote_number ? ` · Cot. ${o.quote_number}` : ""} · Entrega {fmtDay(o.due_date)}</Text>
            </div>
            <Badge size="2xsmall" color={stageColor(o.stage)}>{STAGE_LABEL[o.stage]}</Badge>
          </Link>
        ))}
      </div>
    </Container>
  )
}
