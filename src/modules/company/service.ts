import { MedusaService } from "@medusajs/framework/utils"
import Company from "./models/company"

export type CompanyCode = "fabmetal" | "karven"

type Loose = Record<string, any>

/** Seed rows; the admin edits them afterwards in "Empresas". */
export const DEFAULT_COMPANIES: Loose[] = [
  {
    code: "fabmetal", name: "FABMETAL", brand_line: "FABMETAL", legal_name: "MULTISERVICIOS CHIMAR, S.A.",
    tagline: "Fabricación técnica a medida. Precisión, durabilidad y control en cada proyecto.",
    ruc: "1042515-1-545471 D.V.09", address: "Alcalde Díaz, Panamá Norte, Panamá", website: "http://www.fabmetal.com.pa",
    email: "contact@fabmetal.com.pa", whatsapp: "6662-2199 / 6344-8362",
    bank_name: "Banco General", bank_holder: "MULTISERVICIOS CHIMAR, S.A.", bank_account_type: "Ahorro", bank_account_number: "04-51-00-001169-3",
    from_email: "FABMETAL <cotizaciones@karvenmedical.com>", storefront_url: "https://www.fabmetal.com.pa", color: "#2F4273", sort_order: 1,
  },
  {
    code: "karven", name: "KARVEN Medical", brand_line: "KARVEN Medical", legal_name: "MULTISERVICIOS CHIMAR, S.A.",
    tagline: "Mobiliario médico, veterinario y técnico fabricado en Panamá.",
    ruc: "1042515-1-545471 D.V.09", address: "Calle Hato Azul casa N.º 43, La Cabima, Alcalde Díaz, Panamá", website: "https://karvenmedical.com",
    email: "contact@karvenmedical.com", whatsapp: "6662-2199",
    bank_name: "Banco General", bank_holder: "MULTISERVICIOS CHIMAR, S.A.", bank_account_type: "Ahorro", bank_account_number: "04-51-00-001169-3",
    from_email: "KARVEN Medical <cotizaciones@karvenmedical.com>", storefront_url: "https://karvenmedical.com", color: "#0E6B78", sort_order: 2,
  },
]

class CompanyModuleService extends MedusaService({ Company }) {
  /** Both companies, created from the defaults the first time. */
  async ensureDefaults(): Promise<Loose[]> {
    const existing = await this.listCompanies({}, { order: { sort_order: "ASC" } })
    const missing = DEFAULT_COMPANIES.filter((d) => !existing.some((e) => e.code === d.code))
    if (missing.length) await this.createCompanies(missing)
    return this.listCompanies({}, { order: { sort_order: "ASC" } })
  }

  async byCode(code: string): Promise<Loose | null> {
    const [company] = await this.listCompanies({ code }, { take: 1 })
    return company || null
  }
}

export default CompanyModuleService
