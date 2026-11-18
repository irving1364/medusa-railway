import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import QuoteForm from "../../../components/quote-form"
import { defaultCompanyCode, getCompany } from "../../../lib/companies"
import { createQuote, emptyQuote, errorMessage, listProfiles, toBody, type QuoteInput, type QuoteProfile, type QuoteStore, lineProblem } from "../../../lib/quotes"

/** /cotizaciones/new — the number is assigned on first save. */
const NewQuotePage = () => {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<QuoteProfile[]>([])
  const [value, setValue] = useState<QuoteInput>(emptyQuote(defaultCompanyCode(getCompany())))
  const [busy, setBusy] = useState(false)
  const profile = profiles.find((p) => p.store === value.store) || null

  useEffect(() => {
    const initial = defaultCompanyCode(getCompany())
    listProfiles().then(({ profiles }) => { setProfiles(profiles); const p = profiles.find((x) => x.store === initial) || null; setValue(emptyQuote(initial, p)) }).catch(() => {})
  }, [])

  const changeStore = (next: QuoteInput) => {
    if (next.store !== value.store) {
      const p = profiles.find((x) => x.store === next.store) || null
      const blank = emptyQuote(next.store as QuoteStore, p)
      setValue({ ...next, warranty_text: blank.warranty_text, payment_terms: blank.payment_terms, general_terms: blank.general_terms, valid_until: blank.valid_until })
      return
    }
    setValue(next)
  }

  const save = async () => {
    if (!value.customer_name.trim()) { toast.error("Escriba el nombre del cliente"); return }
    const problem = lineProblem(value.lines)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try {
      const { quote } = await createQuote(toBody(value))
      toast.success(`Cotización ${quote.number} creada`)
      navigate(`/cotizaciones/${quote.id}`, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo crear"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h1">Nueva cotización</Heading>
          <Text size="small" className="text-ui-fg-subtle">Siguiente número de {profile?.brand_line.split("|")[0].trim() || "la tienda"}: {profile ? `${profile.number_prefix}${String(profile.next_number).padStart(profile.number_digits || 4, "0")}` : "…"}</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => navigate("/cotizaciones")}>Cancelar</Button>
          <Button size="small" isLoading={busy} onClick={save}>Crear borrador</Button>
        </div>
      </Container>
      <QuoteForm value={value} onChange={changeStore} profile={profile} lockStore={false} />
    </div>
  )
}

export default NewQuotePage
