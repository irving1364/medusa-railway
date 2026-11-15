import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../../modules/company"
import type CompanyModuleService from "../../../../modules/company/service"

/** POST /admin/companies/:code — edits a company's identity, bank details, email sender or storefront. */
export async function POST(req: AuthenticatedMedusaRequest<Record<string, unknown>>, res: MedusaResponse) {
  const service = req.scope.resolve(COMPANY_MODULE) as CompanyModuleService
  const current = await service.byCode(req.params.code)
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Empresa desconocida")
  const company = await service.updateCompanies({ id: current.id, ...req.validatedBody } as Record<string, any>)
  res.json({ company })
}
