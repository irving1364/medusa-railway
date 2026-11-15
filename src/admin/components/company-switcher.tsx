import { Button, Text } from "@medusajs/ui"
import { COMPANY_LABEL, useCompany, type CompanySelection } from "../lib/companies"

const OPTIONS: CompanySelection[] = ["fabmetal", "karven", "all"]

/** Pill switcher FABMETAL / KARVEN / Todas. The choice is remembered per browser and shared by every page. */
export default function CompanySwitcher({ compact = false }: { compact?: boolean }) {
  const [company, setCompany] = useCompany()
  return (
    <div className="flex items-center gap-2">
      {!compact && <Text size="xsmall" className="text-ui-fg-subtle">Empresa</Text>}
      <div className="flex gap-1 rounded-full border border-ui-border-base p-0.5">
        {OPTIONS.map((o) => (
          <Button key={o} size="small" variant={company === o ? "primary" : "transparent"} className="rounded-full" onClick={() => setCompany(o)}>
            {o === "all" ? "Todas" : COMPANY_LABEL[o]}
          </Button>
        ))}
      </div>
    </div>
  )
}
