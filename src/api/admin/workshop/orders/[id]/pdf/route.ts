import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { renderWorkOrderPdf } from "../../../../../../modules/workshop/pdf"
import { identityOf, loadOrder, workshopService, type Loose } from "../../../helpers"

/** GET /admin/workshop/orders/:id/pdf — printable work order for the shop floor (inline; `?download=1` downloads). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const order = await loadOrder(req, req.params.id) as Loose
  const [identity, resources] = await Promise.all([
    identityOf(req, order.company),
    workshopService(req).listWorkshopResources({}, { withDeleted: true } as Loose),
  ])
  const pdf = await renderWorkOrderPdf(order, identity, new Map(resources.map((r) => [r.id, r.name])))
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${order.number}.pdf"`)
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
