import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { FIELD_LABELS, STATUS, fmtDate, listRevisions, type Revision } from "../lib/projects"

const ACTION: Record<Revision["action"], string> = {
  created: "Creó el proyecto",
  updated: "Editó el contenido",
  status: "Cambió el estado",
  archived: "Archivó el proyecto",
  restored: "Restauró el proyecto",
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v))

/** Who changed what and when. Reloads whenever `version` changes (after each save / status move). */
export default function HistoryCard({ projectId, version }: { projectId: string; version: number }) {
  const [items, setItems] = useState<Revision[]>([])
  useEffect(() => {
    listRevisions(projectId).then(({ revisions }) => setItems(revisions)).catch(() => {})
  }, [projectId, version])

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">Historial</Heading></div>
      {items.length === 0 ? (
        <div className="px-6 py-4"><Text size="small" className="text-ui-fg-subtle">Sin movimientos todavía.</Text></div>
      ) : (
        <ol className="divide-y">
          {items.map((r) => (
            <li key={r.id} className="px-6 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Text size="small" weight="plus">{ACTION[r.action] || r.action}</Text>
                {r.action === "status" && r.from_status && r.to_status && (
                  <span className="flex items-center gap-1">
                    <Badge size="2xsmall" color={STATUS[r.from_status].color}>{STATUS[r.from_status].label}</Badge>
                    <span className="text-ui-fg-muted">→</span>
                    <Badge size="2xsmall" color={STATUS[r.to_status].color}>{STATUS[r.to_status].label}</Badge>
                  </span>
                )}
                <span className="flex-1" />
                <Text size="xsmall" className="text-ui-fg-subtle">{fmtDate(r.created_at)}{r.actor_email ? ` · ${r.actor_email}` : ""}</Text>
              </div>
              {r.note && <Text size="small" className="mt-1 text-ui-fg-subtle">“{r.note}”</Text>}
              {r.changes && Object.keys(r.changes).length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {Object.entries(r.changes).map(([field, c]) => (
                    <li key={field} className="text-xs text-ui-fg-subtle">
                      <span className="font-medium text-ui-fg-base">{FIELD_LABELS[field] || field}:</span> {show(c.from)} <span className="text-ui-fg-muted">→</span> {show(c.to)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </Container>
  )
}
