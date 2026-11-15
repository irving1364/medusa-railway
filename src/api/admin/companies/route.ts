import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { COMPANY_MODULE } from "../../../modules/company"
import type CompanyModuleService from "../../../modules/company/service"

type Loose = Record<string, any>

/**
 * GET /admin/companies — both companies. On first use the rows are seeded and each company gets its sales channel:
 * KARVEN keeps the default channel (the storefront's publishable key points at it), FABMETAL gets a channel of its own.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(COMPANY_MODULE) as CompanyModuleService
  let companies = await service.ensureDefaults()
  if (companies.some((c) => !c.sales_channel_id)) {
    const channels = req.scope.resolve(Modules.SALES_CHANNEL) as { listSalesChannels: (f: Loose) => Promise<Loose[]>; createSalesChannels: (d: Loose) => Promise<Loose> }
    const all = await channels.listSalesChannels({})
    for (const c of companies) {
      if (c.sales_channel_id) continue
      let channel = c.code === "karven" ? all.find((s) => /default/i.test(s.name)) || all[0] : all.find((s) => s.name.toLowerCase() === c.name.toLowerCase())
      if (!channel) channel = await channels.createSalesChannels({ name: c.name, description: `Canal de venta de ${c.name}` })
      await service.updateCompanies({ id: c.id, sales_channel_id: channel.id } as Loose)
    }
    companies = await service.listCompanies({}, { order: { sort_order: "ASC" } })
  }
  res.json({ companies })
}
