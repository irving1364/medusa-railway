import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { OPEN_STAGES } from "../../../../modules/workshop/service"
import { workshopService, type Loose } from "../helpers"

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** GET /admin/workshop/summary?company=&today=YYYY-MM-DD — the four counters on top of the Taller page. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const company = req.query.company === "fabmetal" || req.query.company === "karven" ? { company: String(req.query.company) } : {}
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.today || "")) ? String(req.query.today) : iso(new Date())
  const t = new Date(`${today}T12:00:00`)
  const sunday = new Date(t); sunday.setDate(t.getDate() + ((7 - t.getDay()) % 7))
  const open = await workshopService(req).listWorkOrders({ stage: OPEN_STAGES, ...company } as Loose, { select: ["id", "stage", "blocked", "due_date"] })
  res.json({
    open: open.length,
    blocked: open.filter((o) => o.blocked).length,
    due_this_week: open.filter((o) => o.due_date && o.due_date <= iso(sunday)).length,
    overdue: open.filter((o) => o.due_date && o.due_date < today).length,
    inspection: open.filter((o) => o.stage === "inspection").length,
  })
}
