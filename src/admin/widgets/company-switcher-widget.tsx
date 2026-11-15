import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Text } from "@medusajs/ui"
import CompanySwitcher from "../components/company-switcher"
import { COMPANY_LABEL, useCompany } from "../lib/companies"

/** Shown above the native Products and Orders lists: the company switcher plus a hint on how those lists are scoped. */
const CompanySwitcherWidget = () => {
  const [company] = useCompany()
  return (
    <Container className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Text size="small" weight="plus">Empresa activa: {COMPANY_LABEL[company]}</Text>
        <Text size="xsmall" className="text-ui-fg-subtle">Esta lista nativa muestra todo. Para ver solo una empresa use el filtro "Sales channel" de la tabla, o trabaje desde Productos web, Proyectos y Cotizaciones, que sí se filtran solos.</Text>
      </div>
      <CompanySwitcher compact />
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: ["product.list.before", "order.list.before"] })

export default CompanySwitcherWidget
