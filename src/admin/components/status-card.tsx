import { Badge, Button, Container, Heading, Text, Textarea, toast } from "@medusajs/ui"
import { ArrowUpRightOnBox, CheckMini } from "@medusajs/icons"
import { useState } from "react"
import { STATUS, STEPS, errorMessage, setProjectStatus, type Project, type ProjectStatus } from "../lib/projects"

interface Props {
  project: Project
  dirty: boolean
  onChanged: (p: Project) => void
}

const ACTIONS: Record<ProjectStatus, { to: ProjectStatus; label: string; primary?: boolean }[]> = {
  draft: [{ to: "review", label: "Enviar a revisión", primary: true }],
  review: [{ to: "approved", label: "Aprobar", primary: true }, { to: "draft", label: "Devolver a borrador" }],
  approved: [{ to: "published", label: "Publicar en la web", primary: true }, { to: "draft", label: "Devolver a borrador" }],
  published: [{ to: "draft", label: "Retirar de la web (a borrador)" }],
}

/** Editorial flow Borrador → Revisión → Aprobación → Publicación, with notes that go to the history. */
export default function StatusCard({ project, dirty, onChanged }: Props) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<ProjectStatus | null>(null)
  const current = STATUS[project.status]

  const go = async (to: ProjectStatus) => {
    if (dirty) { toast.warning("Guarde los cambios antes de cambiar el estado"); return }
    setBusy(to)
    try {
      const { project: updated } = await setProjectStatus(project.id, to, note.trim() || undefined)
      onChanged(updated)
      setNote("")
      toast.success(`Estado: ${STATUS[updated.status].label}`)
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo cambiar el estado"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Estado editorial</Heading>
        <Badge color={current.color} size="small">{current.label}</Badge>
      </div>
      <div className="px-6 py-4">
        <ol className="flex items-center gap-1 rounded-md border border-ui-border-base p-1 text-xs">
          {STEPS.map((s, i) => {
            const done = STATUS[project.status].step > i
            const active = project.status === s.status
            return (
              <li key={s.status} className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 ${active ? "bg-ui-bg-base shadow-elevation-card-rest font-medium" : done ? "text-ui-fg-subtle" : "text-ui-fg-muted"}`}>
                {done && <CheckMini className="text-ui-fg-interactive" />}
                {s.label}
              </li>
            )
          })}
        </ol>
        {project.status === "published" && project.published_at && (
          <Text size="xsmall" className="mt-2 text-ui-fg-subtle">Publicado el {new Intl.DateTimeFormat("es-PA", { dateStyle: "long" }).format(new Date(project.published_at))}</Text>
        )}
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">
        <Textarea rows={2} placeholder="Nota para el historial (opcional): qué se revisó, qué falta..." value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {ACTIONS[project.status].map((a) => (
            <Button key={a.to} size="small" variant={a.primary ? "primary" : "secondary"} isLoading={busy === a.to} disabled={!!busy} onClick={() => go(a.to)}>{a.label}</Button>
          ))}
        </div>
        {dirty && <Text size="xsmall" className="text-ui-fg-subtle">Hay cambios sin guardar. Guarde antes de cambiar el estado.</Text>}
      </div>
      <div className="flex flex-col gap-2 px-6 py-4">
        {project.status === "published" ? (
          <a href={project.public_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-ui-fg-interactive hover:underline">Ver en la web <ArrowUpRightOnBox /></a>
        ) : project.preview_url ? (
          <a href={project.preview_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-ui-fg-interactive hover:underline">Vista previa en la web <ArrowUpRightOnBox /></a>
        ) : (
          <Text size="xsmall" className="text-ui-fg-subtle">La vista previa requiere PROJECT_PREVIEW_SECRET en el servidor.</Text>
        )}
        <Text size="xsmall" className="text-ui-fg-subtle break-all">{project.public_url}</Text>
      </div>
    </Container>
  )
}
