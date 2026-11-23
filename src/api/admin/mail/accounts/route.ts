import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { encryptSecret, publicAccount } from "../../../../modules/mail/service"
import { mailService, type Loose } from "../helpers"

/** GET /admin/mail/accounts?company=karven&active=1 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const filters: Loose = {}
  const company = String(req.query.company || "")
  if (company === "karven" || company === "fabmetal") filters.company = company
  if (req.query.active === "1") filters.active = true
  const accounts = await mailService(req).listMailAccounts(filters, { order: { sort_order: "ASC", created_at: "ASC" } })
  res.json({ accounts: accounts.map(publicAccount) })
}

/** POST /admin/mail/accounts */
export async function POST(req: AuthenticatedMedusaRequest<Loose>, res: MedusaResponse) {
  const { password, ...body } = req.validatedBody
  const account = await mailService(req).createMailAccounts({ ...body, username: body.username || body.email, password_enc: encryptSecret(password), active: body.active ?? true } as Loose)
  res.status(201).json({ account: publicAccount(account) })
}
