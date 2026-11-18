import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { effectiveStatus, fmtMoney, identityFor, notifyCompany, portalUrl, quoteService, type Loose } from "../../../../admin/quotes/helpers"
import { publicQuote, quoteByToken } from "../route"

const ADMIN_URL = (process.env.BACKEND_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")).replace(/\/$/, "")

/**
 * POST /store/quotes/:token/respond — { action: "accept" | "changes" | "reject", name, comment }.
 * Accepting approves the quote; "changes" keeps it open and alerts the team; both notify the company by email.
 */
export async function POST(req: MedusaRequest<{ action: "accept" | "changes" | "reject"; name: string; comment?: string | null }>, res: MedusaResponse) {
  const quote = await quoteByToken(req)
  const { action, name, comment } = req.validatedBody
  if (effectiveStatus(quote) === "expired") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La cotización está vencida. Solicite una actualización.")
  if (quote.status !== "sent") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Esta cotización ya fue respondida.")
  const service = quoteService(req)
  const now = new Date()
  const patch: Loose = { id: quote.id, responded_at: now, response_name: name, response_comment: comment || null }
  if (action === "accept") { patch.status = "approved"; patch.approved_at = now }
  if (action === "reject") { patch.status = "rejected"; patch.rejected_at = now }
  if (action === "changes") patch.changes_requested_at = now
  const updated = await service.updateQuotes(patch)
  const label = action === "accept" ? "Aprobada por el cliente" : action === "reject" ? "Rechazada por el cliente" : "El cliente solicita cambios"
  await service.createQuoteRevisions({ quote_id: quote.id, version: Number(quote.version) || 1, action: `client:${action}`, snapshot: updated as Loose, note: `${label} · ${name}${comment ? `\n${comment}` : ""}`, actor_email: null } as Loose)

  const profile = await identityFor(req, quote.store)
  await notifyCompany(profile, `${label}: cotización ${quote.number} · ${quote.customer_name}`, [
    `${label}.`,
    `Cotización ${quote.number}${Number(quote.version) > 1 ? ` (v${quote.version})` : ""} · ${quote.customer_name} · ${fmtMoney(Number(quote.total))}`,
    `Respondió: ${name}`,
    comment ? `Comentario:\n${comment}` : "",
    ADMIN_URL ? `Abrir en el panel: ${ADMIN_URL}/app/cotizaciones/${quote.id}` : "",
    `Enlace del cliente: ${portalUrl(quote.public_token)}`,
  ].filter(Boolean))
  res.json({ quote: await publicQuote(req, updated) })
}
