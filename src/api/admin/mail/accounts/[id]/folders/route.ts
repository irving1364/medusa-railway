import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listFolders } from "../../../../../../modules/mail/client"
import { accountSettings, mailCall, mailService, type Loose } from "../../../helpers"

/** GET /admin/mail/accounts/:id/folders — folders with totals and unread counts; also records the connection health. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { account, settings } = await accountSettings(req)
  const service = mailService(req)
  try {
    const folders = await mailCall(() => listFolders(settings))
    if (account.last_error || !account.last_check_at || Date.now() - new Date(account.last_check_at).getTime() > 10 * 60 * 1000) {
      await service.updateMailAccounts({ id: account.id, last_check_at: new Date(), last_error: null } as Loose)
    }
    res.json({ folders })
  } catch (e) {
    await service.updateMailAccounts({ id: account.id, last_check_at: new Date(), last_error: e instanceof Error ? e.message : String(e) } as Loose).catch(() => {})
    throw e
  }
}
