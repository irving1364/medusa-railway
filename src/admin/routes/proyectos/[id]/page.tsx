import { Button, Container, Heading, Prompt, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import HistoryCard from "../../../components/history-card"
import ProjectForm from "../../../components/project-form"
import StatusCard from "../../../components/status-card"
import { archiveProject, errorMessage, getProject, updateProject, type Project, type ProjectInput } from "../../../lib/projects"

const toInput = (p: Project): ProjectInput => ({
  title: p.title, slug: p.slug, line: p.line, specialty: p.specialty || "", work_type: p.work_type || "", client_name: p.client_name || "",
  location: p.location || "", year: p.year, summary: p.summary || "", client_need: p.client_need || "", solution: p.solution || "",
  fabrication: p.fabrication || "", cover_url: p.cover_url, cover_alt: p.cover_alt || "", gallery: p.gallery || [],
  related_product_ids: p.related_product_ids || [], seo_title: p.seo_title || "", seo_description: p.seo_description || "", sort_order: p.sort_order ?? 0,
})

/** Edit page: content form + editorial status + history. */
const EditProjectPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [value, setValue] = useState<ProjectInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getProject(id)
      .then(({ project }) => { setProject(project); setValue(toInput(project)) })
      .catch((e) => setError(errorMessage(e, "Proyecto no encontrado")))
  }, [id])

  const dirty = useMemo(() => !!project && !!value && JSON.stringify(toInput(project)) !== JSON.stringify(value), [project, value])

  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", onLeave)
    return () => window.removeEventListener("beforeunload", onLeave)
  }, [dirty])

  const save = async () => {
    if (!project || !value) return
    if (!value.title.trim()) { toast.error("Escriba el título del proyecto"); return }
    setBusy(true)
    try {
      const { project: updated } = await updateProject(project.id, { ...value, slug: value.slug || null } as ProjectInput)
      setProject(updated)
      setValue(toInput(updated))
      setVersion((n) => n + 1)
      toast.success("Cambios guardados")
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar"))
    } finally {
      setBusy(false)
    }
  }

  const archive = async () => {
    if (!project) return
    try {
      await archiveProject(project.id)
      toast.success("Proyecto archivado. Puede restaurarlo desde la pestaña Archivados.")
      navigate("/proyectos")
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo archivar"))
    }
  }

  if (error) return <Container><Text>{error}</Text></Container>
  if (!project || !value) return <Container><Text size="small" className="text-ui-fg-subtle">Cargando...</Text></Container>
  const siteUrl = project.public_url.replace(/\/proyectos\/.*$/, "")

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Heading level="h1" className="truncate">{project.title}</Heading>
          <Text size="small" className="text-ui-fg-subtle">{dirty ? "Cambios sin guardar" : `Guardado · ${project.slug}`}</Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={() => navigate("/proyectos")}>Volver</Button>
          <Prompt>
            <Prompt.Trigger asChild><Button variant="danger" size="small">Archivar</Button></Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>¿Archivar este proyecto?</Prompt.Title>
                <Prompt.Description>Desaparecerá de la web y de la lista. Podrá restaurarlo desde la pestaña Archivados.</Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Cancelar</Prompt.Cancel>
                <Prompt.Action onClick={archive}>Archivar</Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
          <Button size="small" isLoading={busy} disabled={!dirty} onClick={save}>Guardar cambios</Button>
        </div>
      </Container>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ProjectForm value={value} onChange={setValue} siteUrl={siteUrl} />
        <div className="flex flex-col gap-4">
          <StatusCard project={project} dirty={dirty} onChanged={(p) => { setProject(p); setValue(toInput(p)); setVersion((n) => n + 1) }} />
          <HistoryCard projectId={project.id} version={version} />
        </div>
      </div>
    </div>
  )
}

export default EditProjectPage
