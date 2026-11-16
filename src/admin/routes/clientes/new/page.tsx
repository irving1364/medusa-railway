import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import CustomerForm from "../../../components/customer-form"
import { createCustomer, emptyCustomer, errorMessage, toPayload, validate, type CustomerInput } from "../../../lib/customers"

/** /clientes/new — quick customer registration. */
const NewCustomerPage = () => {
  const navigate = useNavigate()
  const [value, setValue] = useState<CustomerInput>(emptyCustomer())
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const problem = validate(value)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try {
      const { customer } = await createCustomer(toPayload(value))
      toast.success("Cliente guardado")
      navigate(`/clientes/${customer.id}`, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div><Heading level="h1">Nuevo cliente</Heading><Text size="small" className="text-ui-fg-subtle">Clientes / Crear registro · Alta rápida</Text></div>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={() => setValue(emptyCustomer())}>Limpiar</Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/clientes")}>Cancelar</Button>
          <Button size="small" isLoading={busy} onClick={save}>Guardar cliente</Button>
        </div>
      </Container>
      <Container><CustomerForm value={value} onChange={setValue} /></Container>
    </div>
  )
}

export default NewCustomerPage
