import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { Resend } from "resend"
import { renderQuotePdf } from "../../../../../modules/quote/pdf"
import type { QuoteStore } from "../../../../../modules/quote/service"
import { actorEmail, ensurePortalToken, fmtDate, fmtMoney, identityFor, portalUrl, quoteService, serialize, type Loose } from "../../helpers"

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
const paragraphs = (t: string) => t.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")

/**
 * POST /admin/quotes/:id/send — renders the PDF, stores it on the file module, emails it through Resend
 * and records the revision. Marks the quote as "sent".
 */
export async function POST(req: AuthenticatedMedusaRequest<{ to: string[]; cc?: string[]; subject: string; message: string }>, res: MedusaResponse) {
  const service = quoteService(req)
  const quote = await ensurePortalToken(req, await service.retrieveQuote(req.params.id))
  const link = portalUrl(quote.public_token)
  if (!(quote.lines as unknown as Loose[])?.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Agregue al menos una línea antes de enviar")
  if (quote.status === "approved" || quote.status === "rejected") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La cotización ya está cerrada; reábrala para enviarla de nuevo")
  if (!process.env.RESEND_API_KEY) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "El envío de correo no está configurado (RESEND_API_KEY)")

  const profile = await identityFor(req, quote.store as QuoteStore)
  const { to, cc, subject, message } = req.validatedBody
  const pdf = await renderQuotePdf(quote, profile)
  const filename = `Cotizacion-${quote.number}${quote.version > 1 ? `-v${quote.version}` : ""}.pdf`

  const { result } = await uploadFilesWorkflow(req.scope).run({ input: { files: [{ filename, mimeType: "application/pdf", content: pdf.toString("base64"), access: "public" }] } })
  const pdfUrl = (result as { url: string }[])[0]?.url || null

  const from = profile.from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const ccList = [...(cc || []), ...(profile.cc_email ? String(profile.cc_email).split(/[,;]\s*/).filter(Boolean) : [])]
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1F2430;max-width:640px">
      ${paragraphs(message)}
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Cotización</td><td style="padding:4px 0"><strong>${esc(quote.number)}</strong>${quote.version > 1 ? ` · versión ${quote.version}` : ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Fecha</td><td style="padding:4px 0">${fmtDate(quote.issue_date)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Válida hasta</td><td style="padding:4px 0">${fmtDate(quote.valid_until) || "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Total</td><td style="padding:4px 0"><strong>${fmtMoney(Number(quote.total))}</strong> (ITBMS incluido)</td></tr>
      </table>
      ${link ? `<p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:${/^#[0-9a-f]{6}$/i.test(String(profile.company?.color || "")) ? profile.company.color : "#2F4273"};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Ver y aprobar la cotización en línea</a></p>` : ""}
      <p style="margin:0 0 12px">Adjuntamos la cotización en PDF.${pdfUrl ? ` También puede verla en <a href="${pdfUrl}" style="color:#2F4273">este enlace</a>.` : ""}</p>
      ${profile.email_signature ? paragraphs(String(profile.email_signature)) : `<p style="margin:16px 0 0">${esc(profile.brand_line)}<br><span style="color:#5C6370">${esc(profile.whatsapp ? `WhatsApp ${profile.whatsapp}` : "")}${profile.whatsapp && profile.email ? " · " : ""}${esc(profile.email || "")}</span></p>`}
    </div>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const sent = await resend.emails.send({
    from, to, cc: ccList.length ? ccList : undefined, subject, html,
    attachments: [{ filename, content: pdf.toString("base64") }],
  })
  if (sent.error) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Resend: ${sent.error.message}`)

  const updated = await service.updateQuotes({ id: quote.id, status: "sent", sent_at: new Date(), last_pdf_url: pdfUrl } as Loose)
  await service.createQuoteRevisions({ quote_id: quote.id, version: updated.version, action: "sent", snapshot: updated as Loose, pdf_url: pdfUrl, sent_to: to.join(", "), note: subject, actor_email: await actorEmail(req) } as Loose)
  res.json({ quote: serialize(updated), pdf_url: pdfUrl, email_id: sent.data?.id || null })
}
