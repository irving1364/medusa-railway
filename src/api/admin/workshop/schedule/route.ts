import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadSchedule } from "../helpers"

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /admin/workshop/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD&company=
 * Activities planned in the range, activities still to plan (open orders), the orders involved and the people.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const from = String(req.query.from || ""), to = String(req.query.to || "")
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Rango de fechas no válido")
  const company = req.query.company === "fabmetal" || req.query.company === "karven" ? String(req.query.company) : null
  res.json(await loadSchedule(req, from, to, company))
}
