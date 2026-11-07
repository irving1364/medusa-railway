import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Resend } from "resend"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")

  // 1. Obtener la información del pedido
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "metadata", "items.title", "items.quantity"],
    filters: { id: data.id },
  })

  const order = orders[0]

  if (!order || !order.email) {
    return
  }

  // Las solicitudes hechas desde la web ya reciben un correo detallado desde el front (/api/checkout).
  // Este correo cubre los pedidos creados por otras vías (admin, API) para no duplicar notificaciones.
  if (order.metadata?.source === "web-checkout") {
    return
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Resend] RESEND_API_KEY no configurada; se omite el correo de la orden #${order.display_id}`)
    return
  }

  // 2. Inicializar cliente de Resend
  const resend = new Resend(process.env.RESEND_API_KEY)

  const itemsHtml = (order.items || [])
    .map((item) => `<li>${item?.title} × ${item?.quantity}</li>`)
    .join("")

  // 3. Enviar el correo electrónico
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: order.email,
      subject: `Hemos recibido su solicitud #${order.display_id} — Karven`,
      html: `
        <h1>Solicitud registrada</h1>
        <p>Hola, registramos su solicitud de información con el número <strong>#${order.display_id}</strong>.</p>
        <ul>${itemsHtml}</ul>
        <p>Un asesor de Karven se pondrá en contacto con usted a la brevedad.</p>
      `,
    })
    console.log(`[Resend] Correo de confirmación enviado a: ${order.email}`)
  } catch (error) {
    console.error("[Resend] Error enviando correo:", error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}