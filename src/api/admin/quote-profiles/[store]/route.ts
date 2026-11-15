import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { QUOTE_MODULE } from "../../../../modules/quote"
import type QuoteModuleService from "../../../../modules/quote/service"

/** POST /admin/quote-profiles/:store — edits the store profile (legal data, bank, default texts, numbering, email). */
export async function POST(req: AuthenticatedMedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const store = req.params.store
  if (store !== "fabmetal" && store !== "karven") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tienda desconocida")
  const service = req.scope.resolve(QUOTE_MODULE) as QuoteModuleService
  const current = await service.profileFor(store)
  const profile = await service.updateQuoteProfiles({ id: current.id, ...req.validatedBody } as Record<string, any>)
  res.json({ profile })
}
