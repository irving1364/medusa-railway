import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { purchaseService, type Loose } from "../purchases/helpers"

/** GET /admin/purchase-items?q=&active=1 — materials and supplies catalogue. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const q = String(req.query.q || "").trim()
  const filters: Loose = {}
  if (req.query.active === "1") filters.active = true
  if (q) filters.$or = [{ name: { $ilike: `%${q}%` } }, { ref: { $ilike: `%${q}%` } }, { category: { $ilike: `%${q}%` } }]
  const [items, count] = await service.listAndCountPurchaseItems(filters, { take: Math.min(Number(req.query.limit) || 100, 300), order: { name: "ASC" } })
  res.json({ items, count })
}

/** POST /admin/purchase-items */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const item = await purchaseService(req).createPurchaseItems({ active: true, unit: "Unidades", ...req.validatedBody } as Loose)
  res.status(201).json({ item })
}
