import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createOrderWorkflow } from "@medusajs/core-flows"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { QuoteLine } from "../../../../../modules/quote/service"
import { actorEmail, identityFor, quoteService, serialize, type Loose } from "../../helpers"

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * POST /admin/quotes/:id/convert — turns an approved quote into a Medusa order (status pending, no customer
 * emails). Lines become custom items at the quoted price (discount applied) with ITBMS included, so the order
 * total equals the quote total. The order keeps quote_id / quote_number in its metadata.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = quoteService(req)
  const quote = await service.retrieveQuote(req.params.id)
  if (quote.status !== "approved") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Solo se convierten cotizaciones aprobadas")
  if (quote.order_id) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Esta cotización ya generó el pedido #${quote.order_display_id ?? ""}`)
  const lines = (quote.lines || []) as unknown as QuoteLine[]
  if (!lines.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "La cotización no tiene líneas")

  const regions = req.scope.resolve(Modules.REGION) as { listRegions: (f: Loose) => Promise<Loose[]> }
  const [region] = await regions.listRegions({ currency_code: String(quote.currency || "pab").toLowerCase() })
  if (!region) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No hay una región con moneda PAB en Medusa")
  const profile = await identityFor(req, quote.store)

  let email = quote.customer_email || null
  if (!email && quote.customer_id) {
    try { const customers = req.scope.resolve(Modules.CUSTOMER) as { retrieveCustomer: (id: string) => Promise<Loose> }; email = (await customers.retrieveCustomer(quote.customer_id)).email || null } catch { /* customer deleted */ }
  }
  const [first, ...rest] = String(quote.contact_name || quote.customer_name).trim().split(/\s+/)
  const address = {
    first_name: first || quote.customer_name, last_name: rest.join(" ") || "",
    company: quote.contact_name ? quote.customer_name : quote.customer_company || null,
    address_1: quote.customer_address || "Por confirmar", city: "Panamá", country_code: "pa", phone: quote.customer_phone || null,
  }

  const items = lines.filter((l) => Number(l.quantity) > 0).map((l) => {
    const net = (Number(l.unit_price) || 0) * (1 - (Number(l.discount_pct) || 0) / 100)
    const rate = Number(l.tax_rate) || 0
    return {
      title: `${l.ref ? `[${l.ref}] ` : ""}${l.title}`.slice(0, 250),
      quantity: Number(l.quantity),
      unit_price: round(net * (1 + rate / 100)),
      is_tax_inclusive: true,
      tax_lines: rate ? [{ code: "ITBMS", rate, description: `ITBMS ${rate}%` }] : [],
      metadata: { quote_line_id: l.id, description: l.description || null, unit: l.unit, discount_pct: l.discount_pct || 0, product_id: l.product_id || null, variant_id: l.variant_id || null },
    }
  })

  const { result: order } = await createOrderWorkflow(req.scope).run({
    input: {
      region_id: region.id,
      currency_code: region.currency_code,
      sales_channel_id: profile.company?.sales_channel_id || undefined,
      customer_id: quote.customer_id || undefined,
      email: email || undefined,
      status: "pending",
      no_notification: true,
      shipping_address: address,
      billing_address: address,
      items,
      metadata: { source: "quote", quote_id: quote.id, quote_number: quote.number, company: quote.store, customer_ruc: quote.customer_ruc || null },
    } as Loose,
  })
  const o = order as Loose
  const updated = await service.updateQuotes({ id: quote.id, order_id: o.id, order_display_id: o.display_id ?? null, converted_at: new Date() } as Loose)
  await service.createQuoteRevisions({ quote_id: quote.id, version: Number(quote.version) || 1, action: "converted", snapshot: updated as Loose, note: `Pedido #${o.display_id} creado`, actor_email: await actorEmail(req) } as Loose)
  res.status(201).json({ quote: serialize(updated), order: { id: o.id, display_id: o.display_id, total: o.total } })
}
