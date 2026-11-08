import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Text, Button, toast } from "@medusajs/ui"
import { useRef, useState } from "react"
import { sdk } from "../lib/sdk"

const META_URL = "datasheet_url"
const META_NAME = "datasheet_name"
const MAX_MB = 25

/**
 * "Ficha técnica (PDF)" panel on the product details page.
 * Uploads a PDF through the file module and stores its URL + name in product metadata,
 * which the storefront reads to show a download button and an inline viewer.
 */
const ProductDatasheetWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const meta = (product.metadata || {}) as Record<string, unknown>
  const url = typeof meta[META_URL] === "string" ? (meta[META_URL] as string) : null
  const name = typeof meta[META_NAME] === "string" ? (meta[META_NAME] as string) : null

  const saveMetadata = async (patch: Record<string, unknown>) => {
    await sdk.admin.product.update(product.id, { metadata: { ...meta, ...patch } })
  }

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Solo se aceptan archivos PDF")
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El PDF supera ${MAX_MB} MB`)
      return
    }
    setBusy(true)
    try {
      const { files } = await sdk.admin.upload.create({ files: [file] })
      const uploaded = files?.[0]
      if (!uploaded?.url) throw new Error("La carga no devolvió una URL")
      await saveMetadata({ [META_URL]: uploaded.url, [META_NAME]: file.name })
      toast.success("Ficha técnica guardada")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir el PDF")
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    if (!window.confirm("¿Quitar la ficha técnica de este producto?")) return
    setBusy(true)
    try {
      await saveMetadata({ [META_URL]: null, [META_NAME]: null })
      toast.success("Ficha técnica quitada")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo quitar el PDF")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Ficha técnica (PDF)</Heading>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
        <Button size="small" variant="secondary" isLoading={busy} onClick={() => inputRef.current?.click()}>
          {url ? "Reemplazar" : "Subir PDF"}
        </Button>
      </div>
      <div className="px-6 py-4">
        {url ? (
          <div className="flex flex-col gap-2">
            <Text size="small" leading="compact" weight="plus">{name || "ficha-tecnica.pdf"}</Text>
            <div className="flex items-center gap-3">
              <a href={url} target="_blank" rel="noreferrer">
                <Button size="small" variant="transparent">Abrir</Button>
              </a>
              <Button size="small" variant="transparent" onClick={onRemove} disabled={busy}>Quitar</Button>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle break-all">{url}</Text>
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Sin ficha técnica. Suba un PDF (máx. {MAX_MB} MB) y aparecerá en la página del producto con botón de descarga y visor.
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductDatasheetWidget
