import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { roundQty } from "../../../../../modules/purchase/service"
import { actorEmail, purchaseService, type Loose } from "../../../purchases/helpers"
import { resyncForItems } from "../../../workshop/helpers"

const num = (v: unknown) => Number(v) || 0
const serializeMovement = (m: Loose) => ({ ...m, quantity: num(m.quantity), balance: num(m.balance) })

/** GET /admin/purchase-items/:id/stock — current stock and the last movements (newest first). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const item = await service.retrievePurchaseItem(req.params.id)
  const movements = await service.listStockMovements({ item_id: item.id }, { order: { created_at: "DESC" }, take: Math.min(Number(req.query.limit) || 50, 200) })
  res.json({ stock: num(item.stock), min_stock: item.min_stock === null ? null : num(item.min_stock), unit: item.unit, movements: movements.map(serializeMovement) })
}

/** POST /admin/purchase-items/:id/stock { count | delta, note } — physical count or correction. */
export async function POST(req: AuthenticatedMedusaRequest<{ count?: number; delta?: number; note?: string | null }>, res: MedusaResponse) {
  const service = purchaseService(req)
  const item = await service.retrievePurchaseItem(req.params.id)
  const { count, delta, note } = req.validatedBody
  const change = roundQty(count !== undefined ? count - num(item.stock) : (delta as number))
  if (change === 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, "El stock ya tiene esa cantidad")
  const { stock, movement } = await service.moveStock({ item_id: item.id, quantity: change, reason: "adjustment", ref_type: count !== undefined ? "count" : null, note: note || (count !== undefined ? "Conteo físico" : null), actor_email: await actorEmail(req) })
  await resyncForItems(req, [item.id])
  res.json({ stock, movement: serializeMovement(movement) })
}
