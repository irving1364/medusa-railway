import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUOTE_MODULE } from "../../../modules/quote"
import type QuoteModuleService from "../../../modules/quote/service"

/** GET /admin/quote-profiles — both store profiles (created from defaults on first use). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(QUOTE_MODULE) as QuoteModuleService
  const profiles = await Promise.all([service.profileFor("fabmetal"), service.profileFor("karven")])
  res.json({ profiles })
}
