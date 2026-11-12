import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { STATUS, errorMessage, fmtDate, lineLabel, listProjects, restoreProject, type Project, type ProjectStatus } from "../../lib/projects"

type Tab = "all" | ProjectStatus | "archived"
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Borradores" },
  { key: "review", label: "En revisión" },
  { key: "approved", label: "Aprobados" },
  { key: "published", label: "Publicados" },
  { key: "archived", label: "Archivados" },
]

/** Portfolio projects shown on karvenmedical.com/proyectos. */
const ProjectsPage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Project[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      listProjects({ q: q.trim() || undefined, status: tab !== "all" && tab !== "archived" ? tab : undefined, deleted: tab === "archived" ? 1 : undefined, limit: 100 })
        .then(({ projects, count }) => { setRows(projects); setCount(count) })
        .catch((e) => toast.error(errorMessage(e, "No se pudo cargar la lista")))
        .finally(() => setLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [tab, q, tick])

  const restore = async (p: Project) => {
    try {
      await restoreProject(p.id)
      toast.success("Proyecto restaurado como borrador")
      setTick((n) => n + 1)
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo restaurar"))
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h1">Proyectos</Heading>
          <Text size="small" className="text-ui-fg-subtle">Portafolio de trabajos realizados. Solo los publicados se ven en la web.</Text>
        </div>
        <Button size="small" onClick={() => navigate("/proyectos/new")}>Nuevo proyecto</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-md px-2.5 py-1 text-sm ${tab === t.key ? "bg-ui-bg-base shadow-elevation-card-rest font-medium" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"}`}>{t.label}</button>
          ))}
        </div>
        <span className="flex-1" />
        <Input size="small" placeholder="Buscar por título..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Proyecto</Table.HeaderCell>
            <Table.HeaderCell>Línea</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
            <Table.HeaderCell>Actualizado</Table.HeaderCell>
            <Table.HeaderCell className="text-right">{tab === "archived" ? "" : "Orden"}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((p) => (
            <Table.Row key={p.id} className={tab === "archived" ? "" : "cursor-pointer"} onClick={() => tab !== "archived" && navigate(`/proyectos/${p.id}`)}>
              <Table.Cell>
                <div className="flex items-center gap-3">
                  {p.cover_url ? <img src={p.cover_url} alt="" className="h-10 w-14 rounded object-cover" /> : <span className="h-10 w-14 rounded bg-ui-bg-subtle" />}
                  <div>
                    <Text size="small" weight="plus">{p.title}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">/proyectos/{p.slug}</Text>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>{lineLabel(p.line)}</Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={STATUS[p.status].color}>{STATUS[p.status].label}</Badge></Table.Cell>
              <Table.Cell>{fmtDate(p.updated_at)}</Table.Cell>
              <Table.Cell className="text-right">
                {tab === "archived" ? <Button size="small" variant="secondary" onClick={(e) => { e.stopPropagation(); restore(p) }}>Restaurar</Button> : p.sort_order}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!loading && rows.length === 0 && (
        <div className="px-6 py-10 text-center"><Text size="small" className="text-ui-fg-subtle">{tab === "archived" ? "No hay proyectos archivados." : "Todavía no hay proyectos. Cree el primero con “Nuevo proyecto”."}</Text></div>
      )}
      <div className="px-6 py-3"><Text size="xsmall" className="text-ui-fg-subtle">{count} proyecto{count === 1 ? "" : "s"}</Text></div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Proyectos", icon: Buildings })

export default ProjectsPage
