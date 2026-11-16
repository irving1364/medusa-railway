import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { purchaseService, type Loose } from "../purchases/helpers"

/** GET /admin/suppliers?q=&active=1 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const q = String(req.query.q || "").trim()
  const filters: Loose = {}
  if (req.query.active === "1") filters.active = true
  if (q) filters.$or = [{ name: { $ilike: `%${q}%` } }, { ruc: { $ilike: `%${q}%` } }, { contact_name: { $ilike: `%${q}%` } }, { email: { $ilike: `%${q}%` } }]
  const [suppliers, count] = await service.listAndCountSuppliers(filters, { take: Math.min(Number(req.query.limit) || 100, 200), order: { name: "ASC" } })
  res.json({ suppliers, count })
}

/** POST /admin/suppliers */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const supplier = await purchaseService(req).createSuppliers({ active: true, ...req.validatedBody } as Loose)
  res.status(201).json({ supplier })
}
