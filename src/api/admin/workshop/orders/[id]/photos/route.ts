import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { actorEmail, loadOrder, logEvent, workshopService, type Loose } from "../../../helpers"

const KIND: Loose = { progress: "avance", inspection: "inspección", delivery: "entrega", issue: "incidencia" }

/** POST /admin/workshop/orders/:id/photos { photos: [{ url, file_id, kind, caption }] } — attaches uploaded photos as evidence. */
export async function POST(req: AuthenticatedMedusaRequest<{ photos: Loose[] }>, res: MedusaResponse) {
  const service = workshopService(req)
  const id = req.params.id
  await service.retrieveWorkOrder(id)
  const actor = await actorEmail(req)
  const { photos } = req.validatedBody
  await service.createWorkImages(photos.map((p) => ({ order_id: id, kind: p.kind, url: p.url, file_id: p.file_id || null, caption: p.caption || null, width: p.width || null, height: p.height || null, actor_email: actor })) as Loose[])
  const byKind = new Map<string, number>()
  for (const p of photos) byKind.set(p.kind, (byKind.get(p.kind) || 0) + 1)
  await logEvent(req, id, "photo", `Fotos: ${[...byKind].map(([k, n]) => `${n} de ${KIND[k]}`).join(", ")}`)
  res.status(201).json({ order: await loadOrder(req, id) })
}
