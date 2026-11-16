import type { HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Prompt, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import CustomerForm from "../../../components/customer-form"
import { customerName, deleteCustomer, errorMessage, getCustomer, toInput, toPayload, updateCustomer, validate, type CustomerInput } from "../../../lib/customers"

/** /clientes/:id — edit a customer; link to the native screen for orders and addresses. */
const EditCustomerPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<HttpTypes.AdminCustomer | null>(null)
  const [value, setValue] = useState<CustomerInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (id) getCustomer(id).then(({ customer }) => { setCustomer(customer); setValue(toInput(customer)) }).catch((e) => setError(errorMessage(e, "Cliente no encontrado"))) }, [id])
  const dirty = useMemo(() => !!customer && !!value && JSON.stringify(toInput(customer)) !== JSON.stringify(value), [customer, value])

  const save = async () => {
    if (!customer || !value) return
    const problem = validate(value)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try {
      const { customer: saved } = await updateCustomer(customer.id, toPayload(value, customer))
      setCustomer(saved); setValue(toInput(saved))
      toast.success("Cliente guardado")
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar"))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <Container><Text>{error}</Text></Container>
  if (!customer || !value) return <Container><Text size="small" className="text-ui-fg-subtle">Cargando…</Text></Container>

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><Heading level="h1" className="truncate">{customerName(customer)}</Heading><Badge size="2xsmall" color={value.type === "company" ? "blue" : "grey"}>{value.type === "company" ? "Empresa" : "Persona"}</Badge></div>
          <Text size="small" className="text-ui-fg-subtle">{dirty ? "Cambios sin guardar" : "Guardado"}</Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" asChild><a href={`/app/customers/${customer.id}`}>Ficha estándar (pedidos)</a></Button>
          <Button size="small" variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/clientes")}>Volver</Button>
          <Button size="small" isLoading={busy} onClick={save} disabled={!dirty}>Guardar cliente</Button>
        </div>
      </Container>
      <Container><CustomerForm value={value} onChange={setValue} /></Container>
      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header><Prompt.Title>Eliminar a {customerName(customer)}</Prompt.Title><Prompt.Description>Se borra el registro del cliente. Sus cotizaciones y pedidos anteriores conservan los datos que ya tenían.</Prompt.Description></Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={async () => { try { await deleteCustomer(customer.id); toast.success("Cliente eliminado"); navigate("/clientes") } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) } }}>Eliminar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}

export default EditCustomerPage
