import { MedusaService } from "@medusajs/framework/utils"
import Material from "./models/material"
import ProductRedirect from "./models/product-redirect"

/** Catalogue helpers for the "Productos web" form: material list and product URL redirects. */
class CatalogModuleService extends MedusaService({ Material, ProductRedirect }) {
  /**
   * Records that `from` now lives at `to`. Chains are collapsed (a → b, then b → c becomes a → c and b → c)
   * and a redirect pointing back to a handle that is live again is removed.
   */
  async pointRedirect(from: string, to: string, productId: string | null): Promise<void> {
    if (!from || !to || from === to) return
    // Anything that pointed at the old handle now points at the new one
    const chained = await this.listProductRedirects({ to_handle: from })
    if (chained.length) await this.updateProductRedirects(chained.map((r) => ({ id: r.id, to_handle: to })))
    // The new handle must not redirect anywhere
    const stale = await this.listProductRedirects({ from_handle: to })
    if (stale.length) await this.deleteProductRedirects(stale.map((r) => r.id))
    const existing = await this.listProductRedirects({ from_handle: from })
    if (existing.length) await this.updateProductRedirects([{ id: existing[0].id, to_handle: to, product_id: productId }])
    else await this.createProductRedirects([{ from_handle: from, to_handle: to, product_id: productId }])
  }
}

export default CatalogModuleService
