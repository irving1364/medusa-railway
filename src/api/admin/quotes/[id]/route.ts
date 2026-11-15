import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { actorEmail, bodyToRow, quoteService, serialize, type Loose } from "../helpers"

/** GET /admin/quotes/:id */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const quote = await quoteService(req).retrieveQuote(req.params.id)
  res.json({ quote: serialize(quote) })
}

/** POST /admin/quotes/:id — edits content. Approved/rejected quotes only accept internal notes; "sent" ones go back to draft as a new version. */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const service = quoteService(req)
  const current = await service.retrieveQuote(req.params.id)
  const body = req.validatedBody
  const row = bodyToRow(body)
  const contentKeys = Object.keys(row).filter((k) => k !== "notes_internal" && k !== "metadata")
  if ((current.status === "approved" || current.status === "rejected") && contentKeys.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `La cotización está ${current.status === "approved" ? "aprobada" : "rechazada"}; reábrala antes de editarla`)
  }
  if (current.status === "sent" && contentKeys.length) {
    row.status = "draft"
    row.version = (Number(current.version) || 1) + 1
  }
  const quote = await service.updateQuotes({ id: current.id, ...row } as Loose)
  if (row.version) await service.createQuoteRevisions({ quote_id: quote.id, version: row.version, action: "reopened", snapshot: quote as Loose, note: "Editada después de enviarse", actor_email: await actorEmail(req) } as Loose)
  res.json({ quote: serialize(quote) })
}

/** DELETE /admin/quotes/:id — soft delete (number is not reused). */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await quoteService(req).softDeleteQuotes([req.params.id])
  res.json({ id: req.params.id, object: "quote", deleted: true })
}
