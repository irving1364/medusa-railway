import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { renderWeekPdf } from "../../../../../modules/workshop/pdf"
import { identityOf, loadSchedule } from "../../helpers"

/** Monday of the week of a "YYYY-MM-DD" day. */
const mondayOf = (s: string) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const plus = (s: string, n: number) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

/**
 * GET /admin/workshop/schedule/pdf?week=YYYY-MM-DD&company= — weekly program (Mon–Sat) to post in the workshop.
 * Letterhead: the selected company, or FABMETAL (the workshop) when both are shown.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const week = String(req.query.week || "")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Indique la semana (YYYY-MM-DD)")
  const from = mondayOf(week)
  const company = req.query.company === "fabmetal" || req.query.company === "karven" ? String(req.query.company) : null
  const [data, identity] = await Promise.all([loadSchedule(req, from, plus(from, 6), company), identityOf(req, company || "fabmetal")])
  const pdf = await renderWeekPdf(from, data, identity, company ? "" : "FABMETAL y KARVEN")
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="Programa-taller-${from}.pdf"`)
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
