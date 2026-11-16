import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Buildings } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import CompanySwitcher from "../../components/company-switcher"
import { companyColor, listCompanies, updateCompany, type Company, type CompanyCode } from "../../lib/companies"
import { webUpload } from "../../lib/web-products"

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label size="small" weight="plus">{label}</Label>
    {children}
    {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
  </div>
)

/** /empresas — the companies sharing this backend: identity for documents, bank details, email sender and storefront. */
const CompaniesPage = () => {
  const [saved, setSaved] = useState<Company[]>([])
  const [code, setCode] = useState<CompanyCode>("fabmetal")
  const [value, setValue] = useState<Company | null>(null)
  const [busy, setBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.type !== "image/png" && file.type !== "image/jpeg") { toast.error("El logo debe ser PNG o JPG (el PDF no admite otros formatos)"); return }
    if (file.size > 2 * 1024 * 1024) { toast.error("El logo supera 2 MB"); return }
    setLogoBusy(true)
    try { const [u] = await webUpload([file], true); set("logo_url", u.url); toast.success("Logo cargado; pulse Guardar") } catch (err) { toast.error(err instanceof Error ? err.message : "No se pudo subir el logo") } finally { setLogoBusy(false) }
  }

  useEffect(() => { listCompanies().then(({ companies }) => { setSaved(companies); setValue(companies.find((c) => c.code === "fabmetal") || companies[0] || null) }).catch((e) => toast.error(e instanceof Error ? e.message : "No se pudieron cargar las empresas")) }, [])
  const original = saved.find((c) => c.code === code) || null
  const dirty = useMemo(() => !!value && !!original && JSON.stringify(value) !== JSON.stringify(original), [value, original])
  const pick = (c: CompanyCode) => { if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cambiar de empresa y descartarlos?")) return; setCode(c); setValue(saved.find((x) => x.code === c) || null) }
  const set = <K extends keyof Company>(k: K, v: Company[K]) => value && setValue({ ...value, [k]: v })
  const text = (k: keyof Company) => ({ value: (value?.[k] as string) || "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never) })

  const save = async () => {
    if (!value) return
    setBusy(true)
    try {
      const { id: _i, code: _c, sales_channel_id: _s, ...body } = value
      const { company } = await updateCompany(code, body)
      setSaved((all) => all.map((c) => (c.code === code ? company : c)))
      setValue(company)
      toast.success("Empresa guardada")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h1">Empresas</Heading>
          <Text size="small" className="text-ui-fg-subtle">Las dos empresas que comparten este panel. Cada una tiene su identidad en documentos y correos, su canal de venta y su web.</Text>
        </div>
        <div className="flex items-center gap-3">
          <CompanySwitcher />
          <Button size="small" isLoading={busy} onClick={save} disabled={!dirty}>Guardar</Button>
        </div>
      </Container>

      <div className="flex gap-1">
        {saved.map((c) => (
          <Button key={c.code} size="small" variant={code === c.code ? "primary" : "secondary"} onClick={() => pick(c.code)}>{c.name}</Button>
        ))}
      </div>

      {value && (
        <>
          <Container className="divide-y p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
              <Heading level="h2">Identidad</Heading>
              <div className="flex items-center gap-2">
                <Badge size="2xsmall" color={companyColor(value.code)}>{value.code}</Badge>
                {value.sales_channel_id ? <Badge size="2xsmall" color="grey">Canal de venta: {value.sales_channel_id}</Badge> : <Badge size="2xsmall" color="orange">Sin canal de venta</Badge>}
              </div>
            </div>
            <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
              <Field label="Nombre comercial"><Input {...text("name")} /></Field>
              <Field label="Marca en documentos (cabecera del PDF)" hint='Ej. "FABMETAL" o "FABMETAL | KARVEN Medical"'><Input {...text("brand_line")} /></Field>
              <Field label="Razón social"><Input {...text("legal_name")} /></Field>
              <Field label="R.U.C."><Input {...text("ruc")} /></Field>
              <div className="md:col-span-2"><Field label="Lema" hint="Hasta dos líneas; la segunda sale en cursiva."><Textarea rows={2} {...text("tagline")} /></Field></div>
              <Field label="Dirección"><Input {...text("address")} /></Field>
              <Field label="Sitio web"><Input {...text("website")} /></Field>
              <Field label="Correo público"><Input {...text("email")} /></Field>
              <Field label="WhatsApp"><Input {...text("whatsapp")} /></Field>
              <Field label="Logo" hint="PNG o JPG hasta 2 MB; se muestra arriba a la derecha de los documentos.">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-md border border-ui-border-base bg-white">{value.logo_url ? <img src={value.logo_url} alt="" className="max-h-12 max-w-[4.5rem] object-contain" /> : <Text size="xsmall" className="text-ui-fg-muted">Sin logo</Text>}</div>
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
                  <Button size="small" variant="secondary" type="button" isLoading={logoBusy} onClick={() => logoInput.current?.click()}>{value.logo_url ? "Cambiar logo" : "Subir logo"}</Button>
                  {value.logo_url && <Button size="small" variant="transparent" type="button" onClick={() => set("logo_url", null)}>Quitar</Button>}
                </div>
              </Field>
              <Field label="Color" hint="Para distinguirla en el panel."><Input placeholder="#2F4273" {...text("color")} /></Field>
            </div>
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Datos bancarios</Heading></div>
            <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
              <Field label="Banco"><Input {...text("bank_name")} /></Field>
              <Field label="Titular de la cuenta"><Input {...text("bank_holder")} /></Field>
              <Field label="Tipo de cuenta"><Input {...text("bank_account_type")} /></Field>
              <Field label="Número de cuenta"><Input {...text("bank_account_number")} /></Field>
            </div>
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4"><Heading level="h2">Correo y web</Heading></div>
            <div className="grid gap-4 px-6 py-4 md:grid-cols-2">
              <Field label="Remitente de correos" hint="Debe ser de un dominio verificado en Resend (hoy karvenmedical.com)."><Input placeholder="FABMETAL <cotizaciones@fabmetal.com.pa>" {...text("from_email")} /></Field>
              <Field label="Copia siempre a" hint="Correos separados por coma."><Input placeholder="ventas@fabmetal.com.pa" {...text("cc_email")} /></Field>
              <Field label="Web pública" hint="Se usa en enlaces del panel."><Input placeholder="https://www.fabmetal.com.pa" {...text("storefront_url")} /></Field>
            </div>
          </Container>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "Empresas", icon: Buildings })

export default CompaniesPage
