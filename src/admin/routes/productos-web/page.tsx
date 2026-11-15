import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import MaterialsDialog from "../../components/materials-dialog"
import { availabilityLabel, errorMessage, fmtDate, listMaterials, listWebProducts, type AdminProduct, type Material } from "../../lib/web-products"

type Tab = "all" | "draft" | "published"
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "published", label: "Publicados" },
  { key: "draft", label: "Borradores" },
]

/** Products as the website shows them: the four-block form instead of the generic Medusa product screen. */
const WebProductsPage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<AdminProduct[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialsOpen, setMaterialsOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      listWebProducts({ q: q.trim() || undefined, status: tab === "all" ? undefined : tab, limit: 100 })
        .then(({ products, count }) => { setRows(products as AdminProduct[]); setCount(count) })
        .catch((e) => toast.error(errorMessage(e, "No se pudo cargar la lista")))
        .finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [tab, q])

  useEffect(() => { listMaterials().then(({ materials }) => setMaterials(materials)).catch(() => {}) }, [])

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Heading level="h1">Productos web</Heading>
            <Text size="small" className="text-ui-fg-subtle">Catálogo de karvenmedical.com. Información general, especificaciones, fotografías y SEO en un solo formulario.</Text>
          </div>
          <div className="flex gap-2">
            <Button size="small" variant="secondary" onClick={() => setMaterialsOpen(true)}>Materiales</Button>
            <Button size="small" onClick={() => navigate("/productos-web/new")}>Nuevo producto</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-6 py-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button key={t.key} size="small" variant={tab === t.key ? "primary" : "transparent"} onClick={() => setTab(t.key)}>{t.label}</Button>
            ))}
          </div>
          <span className="flex-1" />
          <Input size="small" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Producto</Table.HeaderCell>
              <Table.HeaderCell>Categoría</Table.HeaderCell>
              <Table.HeaderCell>Material</Table.HeaderCell>
              <Table.HeaderCell>Disponibilidad</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Actualizado</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((p) => {
              const m = (p.metadata || {}) as Record<string, unknown>
              return (
                <Table.Row key={p.id} className="cursor-pointer" onClick={() => navigate(`/productos-web/${p.id}`)}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-12 shrink-0 overflow-hidden rounded bg-white">{p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-contain" /> : null}</div>
                      <div className="min-w-0">
                        <Text size="small" weight="plus" className="truncate">{p.title}</Text>
                        <Text size="xsmall" className="truncate text-ui-fg-subtle">/mobiliario/{p.handle}</Text>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{p.categories?.[0]?.name || <span className="text-ui-fg-muted">—</span>}</Table.Cell>
                  <Table.Cell>{p.material || (m.material as string) || <span className="text-ui-fg-muted">—</span>}</Table.Cell>
                  <Table.Cell>{availabilityLabel(m.availability as string)}</Table.Cell>
                  <Table.Cell><Badge size="2xsmall" color={p.status === "published" ? "green" : "orange"}>{p.status === "published" ? "Publicado" : "Borrador"}</Badge></Table.Cell>
                  <Table.Cell>{p.updated_at ? fmtDate(String(p.updated_at)) : ""}</Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
        {!loading && rows.length === 0 && (
          <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">{q ? "Ningún producto coincide con la búsqueda." : "Todavía no hay productos. Cree el primero con \"Nuevo producto\"."}</Text></div>
        )}
        <div className="px-6 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{loading ? "Cargando…" : `${count} producto${count === 1 ? "" : "s"}`}</Text></div>
      </Container>
      <MaterialsDialog open={materialsOpen} onOpenChange={setMaterialsOpen} materials={materials} onChanged={setMaterials} />
    </>
  )
}

export const config = defineRouteConfig({ label: "Productos web", icon: SquaresPlus })

export default WebProductsPage
