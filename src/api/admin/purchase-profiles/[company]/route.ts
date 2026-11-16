import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { purchaseService, type Loose } from "../../purchases/helpers"

/** POST /admin/purchase-profiles/:company — numbering, default ship-to, payment terms, tax and signature. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const company = req.params.company
  if (company !== "fabmetal" && company !== "karven") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Empresa desconocida")
  const service = purchaseService(req)
  const current = await service.profileFor(company)
  const profile = await service.updatePurchaseProfiles({ id: current.id, ...req.validatedBody } as Loose)
  res.json({ profile })
}
