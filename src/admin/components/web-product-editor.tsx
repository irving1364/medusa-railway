import { Badge, Button, Container, Heading, Prompt, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  STOREFRONT_URL, createRedirect, createWebProduct, defaultSalesChannelId, deleteVariant, deleteWebProduct, emptyForm, errorMessage, featuredCollectionId, findByHandle, getWebProduct, listCategories, listMaterials, listRedirects, productPreviewUrl,
  publishProblems, suggestHandle, toForm, toPayload, updateWebProduct, type AdminProduct, type Category, type Material, type WebProductForm as FormValue,
} from "../lib/web-products"
import MaterialsDialog from "./materials-dialog"
import WebProductForm from "./web-product-form"

/** Create/edit screen shared by /productos-web/new and /productos-web/:id. */
export default function WebProductEditor({ productId }: { productId?: string }) {
  const navigate = useNavigate()
  const isNew = !productId
  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [value, setValue] = useState<FormValue | null>(isNew ? emptyForm() : null)
  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [salesChannelId, setSalesChannelId] = useState<string | null>(null)
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previousHandles, setPreviousHandles] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmHandle, setConfirmHandle] = useState<{ from: string; to: string } | null>(null)

  useEffect(() => {
    Promise.all([listCategories(), listMaterials(), defaultSalesChannelId(), featuredCollectionId().catch(() => null)])
      .then(([cats, { materials }, sc, col]) => { setCategories(cats); setMaterials(materials); setSalesChannelId(sc); setCollectionId(col) })
      .catch((e) => toast.error(errorMessage(e, "No se pudieron cargar categorías y materiales")))
  }, [])

  useEffect(() => {
    if (!productId) return
    getWebProduct(productId)
      .then(({ product }) => { setProduct(product); setValue(toForm(product)) })
      .catch((e) => setError(errorMessage(e, "Producto no encontrado")))
    listRedirects(productId).then(({ redirects }) => setPreviousHandles(redirects.map((r) => r.from_handle))).catch(() => {})
  }, [productId])

  useEffect(() => {
    if (!product || product.status === "published") { setPreviewUrl(null); return }
    productPreviewUrl(product.handle).then(({ url }) => setPreviewUrl(url)).catch(() => setPreviewUrl(null))
  }, [product])

  const dirty = useMemo(() => !!value && (isNew ? JSON.stringify(value) !== JSON.stringify(emptyForm()) : !!product && JSON.stringify(toForm(product)) !== JSON.stringify(value)), [value, product, isNew])

  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", onLeave)
    return () => window.removeEventListener("beforeunload", onLeave)
  }, [dirty])

  const persist = async (form: FormValue) => {
    const category = categories.find((c) => c.id === form.categoryId) || null
    const handle = form.handle.trim() || suggestHandle(form)
    const clash = (await findByHandle(handle)).filter((p) => p.id !== product?.id)
    if (clash.length) { toast.error(`La URL "${handle}" ya la usa otro producto. Cambie la URL del producto.`); return }
    if (form.featured && !collectionId) { toast.error("No existe la colección \"destacados\" en Medusa; cree la colección o desactive Destacado"); return }
    const body = toPayload({ ...form, handle }, category, salesChannelId, product, collectionId)
    setBusy(true)
    try {
      // Variants removed in the form are deleted explicitly before the update
      if (product) for (const v of product.variants || []) if (!form.variants.some((r) => r.id === v.id)) await deleteVariant(product.id, v.id)
      const { product: saved } = product ? await updateWebProduct(product.id, body) : await createWebProduct(body)
      if (product && product.status === "published" && product.handle !== saved.handle) {
        await createRedirect(product.handle, saved.handle, saved.id)
        setPreviousHandles((h) => [product.handle, ...h.filter((x) => x !== product.handle && x !== saved.handle)])
      }
      setProduct(saved)
      setValue(toForm(saved))
      toast.success(saved.status === "published" ? "Guardado y publicado en la web" : "Guardado como borrador")
      if (isNew) navigate(`/productos-web/${saved.id}`, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo guardar"))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!value) return
    if (!value.title.trim()) { toast.error("Escriba el nombre del producto"); return }
    if (value.status === "published") {
      const problems = publishProblems(value)
      if (problems.length) { toast.error(`Para publicar faltan: ${problems.join(", ")}`); return }
    }
    const handle = value.handle.trim() || suggestHandle(value)
    if (product && product.status === "published" && product.handle !== handle) { setConfirmHandle({ from: product.handle, to: handle }); return }
    await persist(value)
  }

  if (error) return <Container><Text>{error}</Text></Container>
  if (!value) return <Container><Text size="small" className="text-ui-fg-subtle">Cargando…</Text></Container>

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Heading level="h1" className="truncate">{isNew ? "Nuevo producto" : product?.title || "Producto"}</Heading>
            {!isNew && product && <Badge size="2xsmall" color={product.status === "published" ? "green" : "orange"}>{product.status === "published" ? "Publicado" : "Borrador"}</Badge>}
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            {isNew ? "4 bloques · Guardar crea el producto" : dirty ? "Cambios sin guardar" : product?.status === "published" ? `En la web: ${STOREFRONT_URL}/mobiliario/${product.handle}` : "Guardado"}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && product?.status === "published" && (
            <Button size="small" variant="secondary" asChild><a href={`${STOREFRONT_URL}/mobiliario/${product.handle}`} target="_blank" rel="noreferrer">Ver en la web</a></Button>
          )}
          {!isNew && product && product.status !== "published" && previewUrl && (
            <Button size="small" variant="secondary" asChild><a href={previewUrl} target="_blank" rel="noreferrer">Vista previa en la web</a></Button>
          )}
          {!isNew && product && (
            <Button size="small" variant="secondary" asChild><a href={`/app/products/${product.id}`}>Ficha estándar de Medusa</a></Button>
          )}
          {!isNew && product && <Button size="small" variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar</Button>}
          <Button size="small" variant="secondary" onClick={() => navigate("/productos-web")}>Volver</Button>
          <Button size="small" isLoading={busy} onClick={save} disabled={!dirty && !isNew}>{value.status === "published" ? "Guardar y publicar" : "Guardar borrador"}</Button>
        </div>
      </Container>

      <WebProductForm
        value={value}
        onChange={setValue}
        categories={categories}
        materials={materials}
        onManageMaterials={() => setMaterialsOpen(true)}
        isNew={isNew}
        productId={product?.id}
        previousHandles={previousHandles}
      />

      <MaterialsDialog open={materialsOpen} onOpenChange={setMaterialsOpen} materials={materials} onChanged={setMaterials} />

      <Prompt open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar "{product?.title}"</Prompt.Title>
            <Prompt.Description>Se borra el producto, sus variantes y su página en la web. No se puede deshacer. Si solo quiere ocultarlo, use "Guardar como borrador" o el estado "No disponible".</Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={async () => { if (!product) return; try { await deleteWebProduct(product.id); toast.success("Producto eliminado"); navigate("/productos-web") } catch (e) { toast.error(errorMessage(e, "No se pudo eliminar")) } }}>Eliminar definitivamente</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      <Prompt open={!!confirmHandle} onOpenChange={(o) => { if (!o) setConfirmHandle(null) }}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Cambiar la URL de un producto publicado</Prompt.Title>
            <Prompt.Description>
              La dirección pasará de /mobiliario/{confirmHandle?.from} a /mobiliario/{confirmHandle?.to}. La URL anterior seguirá funcionando con una redirección permanente, así los enlaces compartidos y Google no se pierden.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={() => { const v = value; setConfirmHandle(null); if (v) persist(v) }}>Cambiar URL y guardar</Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </div>
  )
}
