import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { purchaseService } from "../purchases/helpers"

/** GET /admin/purchase-profiles — purchasing settings of both companies (seeded on first use). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = purchaseService(req)
  const profiles = await Promise.all([service.profileFor("fabmetal"), service.profileFor("karven")])
  res.json({ profiles })
}
