import { CheckCircleSolid, ExclamationCircle, XCircleSolid } from "@medusajs/icons"
import { Badge, Button, Container, FocusModal, Heading, Input, Label, Select, Switch, Table, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { companyColor, companyLabel, defaultCompanyCode, useCompany, type CompanyCode } from "../../../lib/companies"
import { accountToInput, createAccount, DEFAULT_ACCOUNT, deleteAccount, errorMessage, listAccounts, longDate, testAccount, updateAccount, type MailAccount, type MailAccountInput } from "../../../lib/mail"

type TestResult = { ok: boolean; imap: string | null; smtp: string | null; folders: number }

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1"><Label size="small">{label}</Label>{children}{hint && <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text>}</div>
)

/** /correo/cuentas — mailboxes connected over IMAP/SMTP, per company. */
const MailAccountsPage = () => {
  const navigate = useNavigate()
  const [company] = useCompany()
  const [rows, setRows] = useState<MailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MailAccount | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<MailAccountInput>(DEFAULT_ACCOUNT("karven"))
  const [busy, setBusy] = useState<"save" | "test" | null>(null)
  const [test, setTest] = useState<TestResult | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => { setLoading(true); listAccounts(company === "all" ? undefined : company).then(({ accounts }) => setRows(accounts)).catch((e) => toast.error(errorMessage(e, "No se pudo cargar"))).finally(() => setLoading(false)) }, [company, tick])

  const set = <K extends keyof MailAccountInput>(k: K, v: MailAccountInput[K]) => { setValue((prev) => ({ ...prev, [k]: v })); setTest(null) }

  // Typing the address prefills cPanel defaults: mail.<domain>, IMAP 993 and SMTP 465 with SSL.
  const setEmail = (email: string) => {
    setValue((prev) => {
      const domain = email.split("@")[1]?.trim()
      const oldDomain = prev.email.split("@")[1]?.trim()
      const auto = (h: string) => !h || (oldDomain && h === `mail.${oldDomain}`)
      return { ...prev, email, imap_host: domain && auto(prev.imap_host) ? `mail.${domain}` : prev.imap_host, smtp_host: domain && auto(prev.smtp_host) ? `mail.${domain}` : prev.smtp_host, label: prev.label || "" }
    })
    setTest(null)
  }

  const startNew = () => { setEditing(null); setValue(DEFAULT_ACCOUNT(defaultCompanyCode(company))); setTest(null); setOpen(true) }
  const startEdit = (a: MailAccount) => { setEditing(a); setValue(accountToInput(a)); setTest(null); setOpen(true) }

  const payload = (): Partial<MailAccountInput> => {
    const { password, username, ...rest } = value
    return { ...rest, label: value.label.trim() || value.email.trim(), username: username.trim() || value.email.trim(), ...(password ? { password } : {}) }
  }

  const runTest = async () => {
    setBusy("test")
    try { const r = await testAccount({ ...payload(), account_id: editing?.id || null }); setTest(r); if (r.ok) toast.success("Conexión correcta") } catch (e) { toast.error(errorMessage(e, "No se pudo probar")) } finally { setBusy(null) }
  }

  const save = async () => {
    if (!value.email.trim() || !value.imap_host.trim() || !value.smtp_host.trim()) { toast.error("Complete el correo y los servidores"); return }
    if (!editing && !value.password) { toast.error("Escriba la contraseña del buzón"); return }
    setBusy("save")
    try {
      if (editing) await updateAccount(editing.id, payload()); else await createAccount(payload())
      toast.success("Cuenta guardada"); setOpen(false); setTick((n) => n + 1)
    } catch (e) { toast.error(errorMessage(e, "No se pudo guardar")) } finally { setBusy(null) }
  }

  const remove = async (a: MailAccount) => {
    if (!window.confirm(`¿Desconectar ${a.email}? Solo se quita de Medusa; el buzón y sus correos siguen intactos en el servidor.`)) return
    try { await deleteAccount(a.id); setTick((n) => n + 1) } catch (e) { toast.error(errorMessage(e, "No se pudo quitar")) }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div><Heading level="h1">Cuentas de correo</Heading><Text size="small" className="text-ui-fg-subtle">Buzones conectados por IMAP y SMTP. Los correos siguen en su servidor; Outlook y el celular ven lo mismo.</Text></div>
        <div className="flex gap-2"><Button size="small" variant="secondary" onClick={() => navigate("/correo")}>Volver al correo</Button><Button size="small" onClick={startNew}>Conectar cuenta</Button></div>
      </div>
      {!loading && rows.length === 0 && <div className="px-6 py-6"><Text size="small" className="text-ui-fg-subtle">Sin cuentas. Use “Conectar cuenta” con los datos del buzón (los mismos que usa Outlook).</Text></div>}
      <Table>
        <Table.Header><Table.Row><Table.HeaderCell>Cuenta</Table.HeaderCell><Table.HeaderCell>Empresa</Table.HeaderCell><Table.HeaderCell>Servidor</Table.HeaderCell><Table.HeaderCell>Estado</Table.HeaderCell><Table.HeaderCell /></Table.Row></Table.Header>
        <Table.Body>
          {rows.map((a) => (
            <Table.Row key={a.id} className="cursor-pointer" onClick={() => startEdit(a)}>
              <Table.Cell><div className="flex flex-col"><span className="font-medium">{a.label}</span><span className="text-xs text-ui-fg-subtle">{a.email}</span></div></Table.Cell>
              <Table.Cell><Badge size="2xsmall" color={companyColor(a.company)}>{companyLabel(a.company)}</Badge></Table.Cell>
              <Table.Cell><span className="text-xs text-ui-fg-subtle">{a.imap_host}:{a.imap_port} · {a.smtp_host}:{a.smtp_port}</span></Table.Cell>
              <Table.Cell>
                {!a.active ? <Badge size="2xsmall" color="grey">Desactivada</Badge>
                  : a.last_error ? <span className="flex items-center gap-1 text-xs text-ui-fg-error" title={a.last_error}><ExclamationCircle /> {a.last_error.slice(0, 60)}</span>
                    : a.last_check_at ? <span className="flex items-center gap-1 text-xs text-ui-fg-subtle"><CheckCircleSolid className="text-ui-tag-green-icon" /> Conectada · {longDate(a.last_check_at)}</span>
                      : <span className="text-xs text-ui-fg-muted">Sin usar todavía</span>}
              </Table.Cell>
              <Table.Cell className="text-right" onClick={(e) => e.stopPropagation()}><Button size="small" variant="transparent" onClick={() => remove(a)}>Quitar</Button></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-end gap-2">
              <Button size="small" variant="secondary" onClick={runTest} isLoading={busy === "test"} disabled={!!busy}>Probar conexión</Button>
              <Button size="small" onClick={save} isLoading={busy === "save"} disabled={!!busy}>Guardar</Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>Correo</FocusModal.Title>
          <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
            <div className="flex w-full max-w-2xl flex-col gap-6 px-6">
              <div><Heading level="h2">{editing ? editing.email : "Conectar cuenta de correo"}</Heading><Text size="small" className="text-ui-fg-subtle">Use los datos del buzón que da su hosting (cPanel → Cuentas de correo → Conectar dispositivos).</Text></div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Empresa">
                  <Select value={value.company} onValueChange={(v) => set("company", v as CompanyCode)}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content><Select.Item value="karven">KARVEN Medical</Select.Item><Select.Item value="fabmetal">FABMETAL</Select.Item></Select.Content>
                  </Select>
                </Field>
                <Field label="Nombre de la cuenta" hint="Cómo se ve en el selector, p. ej. “Ventas”."><Input size="small" value={value.label} onChange={(e) => set("label", e.target.value)} placeholder="Ventas" /></Field>
                <Field label="Correo"><Input size="small" type="email" value={value.email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@karvenmedical.com" /></Field>
                <Field label="Nombre del remitente" hint="Lo que ve quien recibe el correo."><Input size="small" value={value.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="KARVEN Medical" /></Field>
                <Field label="Usuario" hint="Vacío = el mismo correo (lo normal en cPanel)."><Input size="small" value={value.username} onChange={(e) => set("username", e.target.value)} placeholder={value.email || "contact@karvenmedical.com"} autoComplete="off" /></Field>
                <Field label="Contraseña" hint={editing?.has_password ? "Guardada y cifrada. Escriba solo si quiere cambiarla." : "Se guarda cifrada; nadie la puede leer desde el panel."}><Input size="small" type="password" value={value.password} onChange={(e) => set("password", e.target.value)} placeholder={editing?.has_password ? "••••••••" : ""} autoComplete="new-password" /></Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
                  <Text size="small" weight="plus">Entrante (IMAP)</Text>
                  <Field label="Servidor"><Input size="small" value={value.imap_host} onChange={(e) => set("imap_host", e.target.value.trim())} placeholder="mail.karvenmedical.com" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Puerto"><Input size="small" type="number" value={String(value.imap_port)} onChange={(e) => set("imap_port", Number(e.target.value) || 0)} /></Field>
                    <Field label="SSL/TLS"><div className="flex h-8 items-center"><Switch checked={value.imap_secure} onCheckedChange={(v) => { set("imap_secure", v); if (value.imap_port === 993 || value.imap_port === 143) set("imap_port", v ? 993 : 143) }} /></div></Field>
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
                  <Text size="small" weight="plus">Saliente</Text>
                  <Field label="Enviar por" hint={value.send_method === "resend" ? "Recomendado en Railway: su plan actual bloquea el SMTP saliente. El dominio del correo debe estar verificado en Resend. La copia se guarda igual en Enviados." : "Usa el servidor del hosting. En Railway requiere el plan Pro."}>
                    <Select value={value.send_method} onValueChange={(v) => set("send_method", v as MailAccountInput["send_method"])}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content><Select.Item value="resend">Resend (API)</Select.Item><Select.Item value="smtp">SMTP del hosting</Select.Item></Select.Content>
                    </Select>
                  </Field>
                  {value.send_method === "smtp" && (<>
                  <Field label="Servidor"><Input size="small" value={value.smtp_host} onChange={(e) => set("smtp_host", e.target.value.trim())} placeholder="mail.karvenmedical.com" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Puerto"><Input size="small" type="number" value={String(value.smtp_port)} onChange={(e) => set("smtp_port", Number(e.target.value) || 0)} /></Field>
                    <Field label="SSL/TLS"><div className="flex h-8 items-center"><Switch checked={value.smtp_secure} onCheckedChange={(v) => { set("smtp_secure", v); if (value.smtp_port === 465 || value.smtp_port === 587) set("smtp_port", v ? 465 : 587) }} /></div></Field>
                  </div>
                  </>)}
                </div>
              </div>

              {test && (
                <div className={`flex flex-col gap-1 rounded-lg p-3 ${test.ok ? "bg-ui-tag-green-bg" : "bg-ui-tag-red-bg"}`}>
                  <span className="flex items-center gap-2 text-sm">{test.imap ? <XCircleSolid className="text-ui-tag-red-icon" /> : <CheckCircleSolid className="text-ui-tag-green-icon" />} {test.imap || `Entrante correcto (${test.folders} carpetas)`}</span>
                  <span className="flex items-center gap-2 text-sm">{test.smtp ? <XCircleSolid className="text-ui-tag-red-icon" /> : <CheckCircleSolid className="text-ui-tag-green-icon" />} {test.smtp || (value.send_method === "resend" ? "Saliente por Resend listo" : "Saliente correcto")}</span>
                </div>
              )}

              <Field label="Firma" hint="Se agrega al final de cada correo enviado desde esta cuenta."><Textarea rows={4} value={value.signature} onChange={(e) => set("signature", e.target.value)} placeholder={"Departamento de ventas\nKARVEN Medical · +507 6662-2199\nkarvenmedical.com"} /></Field>
              <div className="flex items-center gap-3"><Switch checked={value.active} onCheckedChange={(v) => set("active", v)} /><Text size="small">Cuenta activa</Text></div>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export default MailAccountsPage
