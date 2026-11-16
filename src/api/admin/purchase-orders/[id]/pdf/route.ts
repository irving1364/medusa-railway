import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { renderPurchasePdf } from "../../../../../modules/purchase/pdf"
import { identityFor, purchaseService } from "../../../purchases/helpers"

/** GET /admin/purchase-orders/:id/pdf — current state of the order as PDF (inline; `?download=1` downloads). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const order = await purchaseService(req).retrievePurchaseOrder(req.params.id)
  const profile = await identityFor(req, order.company)
  const pdf = await renderPurchasePdf(order, profile)
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="Orden-de-compra-${order.number}.pdf"`)
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
