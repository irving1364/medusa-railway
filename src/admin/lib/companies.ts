import { useEffect, useState } from "react"
import { sdk } from "./sdk"

export type CompanyCode = "fabmetal" | "karven"
/** "all" shows both companies in the lists. */
export type CompanySelection = CompanyCode | "all"

export interface Company {
  id: string
  code: CompanyCode
  name: string
  brand_line: string
  legal_name: string
  tagline: string | null
  ruc: string | null
  address: string | null
  website: string | null
  email: string | null
  whatsapp: string | null
  logo_url: string | null
  bank_name: string | null
  bank_holder: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  from_email: string | null
  cc_email: string | null
  sales_channel_id: string | null
  storefront_url: string | null
  color: string | null
  active: boolean
  sort_order: number
}

const api = <T,>(path: string, init: { method?: string; body?: unknown } = {}) => sdk.client.fetch<T>(path, { method: init.method || "GET", body: init.body })
export const listCompanies = () => api<{ companies: Company[] }>("/admin/companies")
export const updateCompany = (code: CompanyCode, body: Partial<Company>) => api<{ company: Company }>(`/admin/companies/${code}`, { method: "POST", body })

export const COMPANY_LABEL: Record<CompanySelection, string> = { fabmetal: "FABMETAL", karven: "KARVEN Medical", all: "Todas las empresas" }
export const companyLabel = (code: string | null | undefined) => (code && code in COMPANY_LABEL ? COMPANY_LABEL[code as CompanySelection] : code || "—")
export const companyColor = (code: string | null | undefined): "blue" | "green" | "grey" => (code === "fabmetal" ? "blue" : code === "karven" ? "green" : "grey")

/* ─── Current company (per browser, shared by every page through localStorage + an event) ─── */

const KEY = "karven.company"
const EVENT = "karven:company"

export const getCompany = (): CompanySelection => {
  try { const v = localStorage.getItem(KEY); return v === "fabmetal" || v === "karven" || v === "all" ? v : "karven" } catch { return "karven" }
}
export const setCompany = (value: CompanySelection) => {
  try { localStorage.setItem(KEY, value) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
}

/** Selected company in the admin header switcher; "all" means no filter. */
export const useCompany = (): [CompanySelection, (v: CompanySelection) => void] => {
  const [value, setValue] = useState<CompanySelection>(getCompany)
  useEffect(() => {
    const onChange = (e: Event) => setValue((e as CustomEvent<CompanySelection>).detail)
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setValue(getCompany()) }
    window.addEventListener(EVENT, onChange)
    window.addEventListener("storage", onStorage)
    return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onStorage) }
  }, [])
  return [value, setCompany]
}

/** The selected company as a concrete code for forms (defaults to KARVEN when "all" is selected). */
export const defaultCompanyCode = (sel: CompanySelection): CompanyCode => (sel === "all" ? "karven" : sel)

/** Companies list cached per page. */
export const useCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([])
  useEffect(() => { listCompanies().then(({ companies }) => setCompanies(companies)).catch(() => {}) }, [])
  return companies
}
