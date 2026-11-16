import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { Resend } from "resend"
import { renderPurchasePdf } from "../../../../../modules/purchase/pdf"
import { fmtDate, fmtMoney, identityFor, logEvent, purchaseService, serialize, type Loose } from "../../../purchases/helpers"

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
const paragraphs = (t: string) => t.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")

/** POST /admin/purchase-orders/:id/send — emails the PDF to the supplier (Resend), stores a copy and marks the order as sent. */
export async function POST(req: AuthenticatedMedusaRequest<{ to: string[]; cc?: string[]; subject: string; message: string }>, res: MedusaResponse) {
  const service = purchaseService(req)
  const order = await service.retrievePurchaseOrder(req.params.id)
  if (!(order.lines as unknown as Loose[])?.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Agregue al menos una línea antes de enviar")
  if (order.status === "cancelled" || order.status === "received") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La orden está cerrada")
  if (!process.env.RESEND_API_KEY) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "El envío de correo no está configurado (RESEND_API_KEY)")

  const profile = await identityFor(req, order.company)
  const { to, cc, subject, message } = req.validatedBody
  const pdf = await renderPurchasePdf(order, profile)
  const filename = `Orden-de-compra-${order.number}.pdf`
  const { result } = await uploadFilesWorkflow(req.scope).run({ input: { files: [{ filename, mimeType: "application/pdf", content: pdf.toString("base64"), access: "public" }] } })
  const pdfUrl = (result as { url: string }[])[0]?.url || null

  const from = profile.from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const ccList = [...(cc || []), ...(profile.cc_email ? String(profile.cc_email).split(/[,;]\s*/).filter(Boolean) : [])]
  const buyer = profile.company?.name || profile.brand_line
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1F2430;max-width:640px">
      ${paragraphs(message)}
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Orden de compra</td><td style="padding:4px 0"><strong>${esc(order.number)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Fecha</td><td style="padding:4px 0">${fmtDate(order.order_date)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Llegada esperada</td><td style="padding:4px 0">${fmtDate(order.expected_date) || "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5C6370">Total</td><td style="padding:4px 0"><strong>${fmtMoney(Number(order.total))}</strong> (ITBMS incluido)</td></tr>
      </table>
      <p style="margin:0 0 12px">Adjuntamos la orden de compra en PDF.${pdfUrl ? ` También puede verla en <a href="${pdfUrl}" style="color:#2F4273">este enlace</a>.` : ""}</p>
      ${profile.email_signature ? paragraphs(String(profile.email_signature)) : `<p style="margin:16px 0 0">${esc(buyer)}<br><span style="color:#5C6370">${esc(profile.whatsapp ? `WhatsApp ${profile.whatsapp}` : "")}${profile.whatsapp && profile.email ? " · " : ""}${esc(profile.email || "")}</span></p>`}
    </div>`
  const resend = new Resend(process.env.RESEND_API_KEY)
  const sent = await resend.emails.send({ from, to, cc: ccList.length ? ccList : undefined, subject, html, attachments: [{ filename, content: pdf.toString("base64") }] })
  if (sent.error) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Resend: ${sent.error.message}`)

  const patch: Loose = { id: order.id, last_pdf_url: pdfUrl }
  if (order.status === "draft") { patch.status = "sent"; patch.sent_at = new Date() }
  const updated = await service.updatePurchaseOrders(patch)
  await logEvent(req, order.id, "sent", subject, { to, pdf_url: pdfUrl })
  res.json({ order: serialize(updated), pdf_url: pdfUrl, email_id: sent.data?.id || null })
}
