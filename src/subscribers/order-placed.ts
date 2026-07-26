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
    fields: ["id", "display_id", "email", "total"],
    filters: { id: data.id },
  })

  const order = orders[0]

  if (!order || !order.email) {
    return
  }

  // 2. Inicializar cliente de Resend
  const resend = new Resend(process.env.RESEND_API_KEY)

  // 3. Enviar el correo electrónico
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: order.email,
      subject: `¡Gracias por tu compra! Orden #${order.display_id}`,
      html: `
        <h1>¡Pedido Confirmado!</h1>
        <p>Hola, tu número de pedido es <strong>#${order.display_id}</strong>.</p>
        <p>Gracias por comprar en nuestra tienda.</p>
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