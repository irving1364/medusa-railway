import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import ProjectForm from "../../../components/project-form"
import { createProject, emptyProject, errorMessage, type ProjectInput } from "../../../lib/projects"

const SITE_URL = "https://karvenmedical.com"

/** Creates a draft; the editorial flow continues on the edit page. */
const NewProjectPage = () => {
  const navigate = useNavigate()
  const [value, setValue] = useState<ProjectInput>(emptyProject())
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!value.title.trim()) { toast.error("Escriba el título del proyecto"); return }
    setBusy(true)
    try {
      const { project } = await createProject({ ...value, slug: value.slug || null } as ProjectInput)
      toast.success("Proyecto creado como borrador")
      navigate(`/proyectos/${project.id}`)
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo crear el proyecto"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h1">Nuevo proyecto</Heading>
          <Text size="small" className="text-ui-fg-subtle">Se guarda como borrador. Podrá subir fotos y enviarlo a revisión después de crearlo.</Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={() => navigate("/proyectos")}>Cancelar</Button>
          <Button size="small" isLoading={busy} onClick={save}>Crear borrador</Button>
        </div>
      </Container>
      <ProjectForm value={value} onChange={setValue} siteUrl={SITE_URL} />
    </div>
  )
}

export default NewProjectPage
