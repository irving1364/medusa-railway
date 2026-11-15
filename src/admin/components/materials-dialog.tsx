import { Badge, Button, FocusModal, Heading, IconButton, Input, Switch, Text, Tooltip, toast } from "@medusajs/ui"
import { ArrowDownMini, ArrowUpMini, Check, PencilSquare, Trash, XMark } from "@medusajs/icons"
import { useState } from "react"
import { createMaterial, deleteMaterial, errorMessage, updateMaterial, type Material } from "../lib/web-products"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: Material[]
  onChanged: (next: Material[]) => void
}

/** Manage the "Material principal" list: create, rename, enable/disable, reorder, delete. */
export default function MaterialsDialog({ open, onOpenChange, materials, onChanged }: Props) {
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok) } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(false) }
  }

  const add = () => run(async () => {
    const { material } = await createMaterial(draft.trim())
    onChanged([...materials, material])
    setDraft("")
  }, "Material creado")

  const rename = () => editing && run(async () => {
    const { material } = await updateMaterial(editing.id, { name: editing.name.trim() })
    onChanged(materials.map((m) => (m.id === material.id ? material : m)))
    setEditing(null)
  }, "Material actualizado")

  const toggle = (m: Material) => run(async () => {
    const { material } = await updateMaterial(m.id, { active: !m.active })
    onChanged(materials.map((x) => (x.id === material.id ? material : x)))
  }, m.active ? "Material inhabilitado" : "Material habilitado")

  const remove = (m: Material) => run(async () => {
    await deleteMaterial(m.id)
    onChanged(materials.filter((x) => x.id !== m.id))
  }, "Material eliminado")

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= materials.length) return
    const next = [...materials]
    ;[next[i], next[j]] = [next[j], next[i]]
    run(async () => {
      await Promise.all(next.map((m, k) => updateMaterial(m.id, { sort_order: (k + 1) * 10 })))
      onChanged(next.map((m, k) => ({ ...m, sort_order: (k + 1) * 10 })))
    }, "Orden actualizado")
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content className="max-w-2xl">
        <FocusModal.Header><Heading level="h2">Materiales</Heading></FocusModal.Header>
        <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto p-6">
          <Text size="small" className="text-ui-fg-subtle">Opciones del campo "Material principal". Un material inhabilitado deja de ofrecerse en productos nuevos, pero los productos que ya lo usan no cambian.</Text>
          <div className="flex gap-2">
            <Input size="small" placeholder="Nuevo material, ej. Acero inoxidable AISI 430" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) add() } }} />
            <Button size="small" type="button" onClick={add} disabled={!draft.trim() || busy}>Crear</Button>
          </div>
          <ul className="divide-y divide-ui-border-base rounded-lg border border-ui-border-base">
            {materials.map((m, i) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                {editing?.id === m.id ? (
                  <>
                    <Input size="small" value={editing.name} onChange={(e) => setEditing({ id: m.id, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename() } if (e.key === "Escape") setEditing(null) }} autoFocus />
                    <Tooltip content="Guardar"><IconButton size="small" variant="transparent" type="button" onClick={rename} disabled={!editing.name.trim()}><Check /></IconButton></Tooltip>
                    <Tooltip content="Cancelar"><IconButton size="small" variant="transparent" type="button" onClick={() => setEditing(null)}><XMark /></IconButton></Tooltip>
                  </>
                ) : (
                  <>
                    <Text size="small" className={`flex-1 ${m.active ? "" : "text-ui-fg-muted line-through"}`}>{m.name}</Text>
                    {!m.active && <Badge size="2xsmall" color="grey">Inhabilitado</Badge>}
                    <Tooltip content={m.active ? "Inhabilitar" : "Habilitar"}><span><Switch size="small" checked={m.active} onCheckedChange={() => toggle(m)} disabled={busy} /></span></Tooltip>
                    <Tooltip content="Renombrar"><IconButton size="small" variant="transparent" type="button" onClick={() => setEditing({ id: m.id, name: m.name })}><PencilSquare /></IconButton></Tooltip>
                    <Tooltip content="Subir"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, -1)} disabled={i === 0 || busy}><ArrowUpMini /></IconButton></Tooltip>
                    <Tooltip content="Bajar"><IconButton size="small" variant="transparent" type="button" onClick={() => move(i, 1)} disabled={i === materials.length - 1 || busy}><ArrowDownMini /></IconButton></Tooltip>
                    <Tooltip content="Eliminar de la lista"><IconButton size="small" variant="transparent" type="button" onClick={() => remove(m)} disabled={busy}><Trash /></IconButton></Tooltip>
                  </>
                )}
              </li>
            ))}
            {materials.length === 0 && <li className="px-3 py-4"><Text size="small" className="text-ui-fg-subtle">Sin materiales. Cree el primero arriba.</Text></li>}
          </ul>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
