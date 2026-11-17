import React from "react"

type Loose = Record<string, any>
type PdfLib = typeof import("@react-pdf/renderer", { with: { "resolution-mode": "import" } })
type Img = { data: Buffer; format: "png" | "jpg" } | null

let libPromise: Promise<PdfLib> | null = null
const loadLib = () => (libPromise ||= import("@react-pdf/renderer").then((lib) => {
  lib.Font.register({ family: "Montserrat", fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-italic.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-600-normal.ttf", fontWeight: 600 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-700-normal.ttf", fontWeight: 700 },
  ] })
  lib.Font.registerHyphenationCallback((w) => [w])
  return lib
}))

/** Everything the datasheet prints, already resolved (defaults applied) by the route. */
export interface DatasheetData {
  brand: string
  brandSub: string
  tagline: string
  motto: string
  accent: string
  logo: Img
  code: string
  version: string
  issued: string
  family: string
  title: string
  reference: string
  published: boolean
  approved: boolean
  image: Img
  imageCaption: string
  intendedUse: string
  description: string
  specs: [string, string][]
  drawings: { label: string; image: Img }[]
  hygiene: string
  safety: string
  maintenance: string
  warranty: string
  configurations: string
  notes: string
  maker: string
  website: string
  productUrl: string
}

const NAVY = "#1F3A5F", INK = "#26303B", MUTED = "#6B7480", LINE = "#DCE2E8", SOFT = "#F2F5F7", WARN = "#B4691F"

const makeStyles = ({ StyleSheet }: PdfLib, ACC: string) => StyleSheet.create({
  // No unitless lineHeight on Page: it makes react-pdf drop fixed elements anchored with `bottom`.
  page: { paddingTop: 30, paddingBottom: 78, paddingHorizontal: 36, fontFamily: "Montserrat", fontSize: 8.5, color: INK },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 7, backgroundColor: ACC },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1.2, borderBottomColor: ACC, marginBottom: 12 },
  brandRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  brand: { fontSize: 20, fontWeight: 700, color: NAVY, letterSpacing: 1 },
  brandSub: { fontSize: 11, color: ACC, marginBottom: 2 },
  tagline: { fontSize: 7.5, color: MUTED, marginTop: 3 },
  motto: { fontSize: 7.5, color: ACC, fontStyle: "italic", marginTop: 1 },
  logo: { width: 110, height: 36, objectFit: "contain", objectPosition: "left" },
  docTitle: { fontSize: 17, fontWeight: 700, color: NAVY, textAlign: "right" },
  docState: { fontSize: 7.5, color: WARN, textAlign: "right", marginTop: 3 },
  docStateOk: { fontSize: 7.5, color: ACC, textAlign: "right", marginTop: 3 },
  docRef: { fontSize: 8, color: MUTED, textAlign: "right", marginTop: 3 },
  strip: { flexDirection: "row", backgroundColor: SOFT, borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 8, marginBottom: 12 },
  stripCell: { flex: 1, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: LINE },
  stripLabel: { fontSize: 6.5, fontWeight: 600, color: ACC, letterSpacing: 0.5, marginBottom: 3 },
  stripValue: { fontSize: 10, fontWeight: 700, color: NAVY },
  title: { fontSize: 15, fontWeight: 700, color: NAVY },
  reference: { fontSize: 8, color: MUTED, marginTop: 2, marginBottom: 10 },
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 12 },
  box: { borderWidth: 1, borderColor: LINE, borderRadius: 7, padding: 10 },
  boxSoft: { borderWidth: 1, borderColor: LINE, borderRadius: 7, padding: 10, backgroundColor: SOFT },
  label: { fontSize: 7.5, fontWeight: 700, color: ACC, letterSpacing: 0.4, marginBottom: 4 },
  small: { fontSize: 6.5, color: MUTED, marginBottom: 4 },
  body: { fontSize: 8.5, lineHeight: 1.45, color: INK },
  photo: { width: "100%", height: 175, objectFit: "contain" },
  sepLine: { borderTopWidth: 1, borderTopColor: LINE, marginVertical: 8 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 1.2, borderBottomColor: ACC, paddingBottom: 3, marginBottom: 6, marginTop: 4 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: NAVY, letterSpacing: 0.3 },
  sectionAside: { fontSize: 7, color: MUTED },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden", marginBottom: 12 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  th: { width: "33%", backgroundColor: SOFT, paddingVertical: 6, paddingHorizontal: 10, fontSize: 7, fontWeight: 700, color: NAVY, letterSpacing: 0.3, borderRightWidth: 1, borderRightColor: LINE },
  td: { width: "67%", paddingVertical: 6, paddingHorizontal: 10, fontSize: 8, lineHeight: 1.35 },
  drawRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  drawCell: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  drawHead: { backgroundColor: ACC, color: "#FFFFFF", fontSize: 7.5, fontWeight: 700, textAlign: "center", paddingVertical: 4, letterSpacing: 0.4 },
  drawImg: { width: "100%", height: 150, objectFit: "contain", padding: 6 },
  cards: { flexDirection: "row", gap: 8, marginBottom: 12 },
  card: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 7, padding: 9, backgroundColor: SOFT },
  draftNote: { fontSize: 7, color: WARN, marginTop: 4 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 22, borderTopWidth: 1.2, borderTopColor: ACC, paddingTop: 7 },
  footRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  footStrong: { fontSize: 8, fontWeight: 700, color: NAVY },
  footSmall: { fontSize: 6.5, color: MUTED, marginTop: 2 },
  footLink: { fontSize: 7.5, fontWeight: 700, color: ACC, textDecoration: "none", textAlign: "right" },
  footRight: { fontSize: 6.5, color: MUTED, textAlign: "right", marginTop: 2 },
})

const paragraphs = (t: string) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

const build = (lib: PdfLib, d: DatasheetData) => {
  const { Document, Image, Link, Page, Text, View } = lib
  const s = makeStyles(lib, d.accent)
  const Block = ({ title, text }: { title: string; text: string }) => (
    <View>
      <Text style={s.label}>{title.toUpperCase()}</Text>
      {paragraphs(text).map((p, i) => <Text key={i} style={[s.body, i ? { marginTop: 4 } : {}]}>{p}</Text>)}
    </View>
  )
  const SectionHead = ({ title, aside }: { title: string; aside?: string }) => (
    <View style={s.sectionHead} minPresenceAhead={60}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      {aside ? <Text style={s.sectionAside}>{aside}</Text> : null}
    </View>
  )
  const criteria = [["Higiene y limpieza", d.hygiene], ["Seguridad de uso", d.safety], ["Mantenimiento", d.maintenance]].filter(([, t]) => t.trim())
  const extra = [["Garantía", d.warranty], ["Configuraciones", d.configurations], ["Notas técnicas", d.notes]].filter(([, t]) => t.trim())
  const drawings = d.drawings.filter((x) => x.image)
  const state = d.approved ? "Versión aprobada" : d.published ? "Pendiente de aprobación técnica" : "Modelo de diseño · No publicado"

  return (
    <Document title={`Ficha técnica ${d.code} · ${d.title}`} author={d.brand} subject={d.title}>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} fixed />
        <View style={s.header} fixed>
          <View>
            {d.logo ? <Image src={d.logo} style={s.logo} /> : (
              <View style={s.brandRow}><Text style={s.brand}>{d.brand}</Text>{d.brandSub ? <Text style={s.brandSub}>{d.brandSub}</Text> : null}</View>
            )}
            {d.tagline ? <Text style={s.tagline}>{d.tagline}</Text> : null}
            {d.motto ? <Text style={s.motto}>{d.motto}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>FICHA TÉCNICA</Text>
            <Text style={d.approved ? s.docStateOk : s.docState}>{state}</Text>
            <Text style={s.docRef} render={({ pageNumber }) => (pageNumber > 1 ? `${d.title} · ${d.code}` : "")} />
          </View>
        </View>

        <View style={s.strip}>
          <View style={s.stripCell}><Text style={s.stripLabel}>CÓDIGO DE FICHA</Text><Text style={s.stripValue}>{d.code}</Text></View>
          <View style={[s.stripCell, { flex: 0.6 }]}><Text style={s.stripLabel}>VERSIÓN</Text><Text style={s.stripValue}>{d.version}</Text></View>
          <View style={s.stripCell}><Text style={s.stripLabel}>FECHA DE EMISIÓN</Text><Text style={s.stripValue}>{d.issued}</Text></View>
          <View style={[s.stripCell, { flex: 1.4, borderRightWidth: 0 }]}><Text style={s.stripLabel}>FAMILIA</Text><Text style={s.stripValue}>{d.family || "—"}</Text></View>
        </View>

        <Text style={s.title}>{d.title}</Text>
        {d.reference ? <Text style={s.reference}>{d.reference}</Text> : <View style={{ height: 10 }} />}

        <View style={s.twoCol} wrap={false}>
          <View style={[s.boxSoft, { width: "46%" }]}>
            <Text style={s.label}>IMAGEN DEL PRODUCTO</Text>
            {d.imageCaption ? <Text style={s.small}>{d.imageCaption}</Text> : null}
            {d.image ? <Image src={d.image} style={s.photo} /> : <Text style={s.small}>Sin imagen.</Text>}
          </View>
          <View style={[s.box, { flex: 1 }]}>
            {d.intendedUse ? <Block title="Uso previsto" text={d.intendedUse} /> : null}
            {d.intendedUse && d.description ? <View style={s.sepLine} /> : null}
            {d.description ? <Block title="Descripción general" text={d.description} /> : null}
          </View>
        </View>

        <SectionHead title="Especificaciones técnicas" aside="Información del modelo" />
        <View style={s.table}>
          {d.specs.map(([k, v], i) => (
            <View key={k + i} style={[s.tr, i === 0 ? { borderTopWidth: 0 } : {}]} wrap={false}>
              <Text style={s.th}>{k.toUpperCase()}</Text>
              <Text style={s.td}>{v}</Text>
            </View>
          ))}
        </View>

        {drawings.length > 0 && (
          <View wrap={false}>
            <SectionHead title="Plano dimensional" aside="Medidas en milímetros" />
            <View style={s.drawRow}>
              {drawings.map((x) => (
                <View key={x.label} style={s.drawCell}>
                  <Text style={s.drawHead}>{x.label.toUpperCase()}</Text>
                  {x.image ? <Image src={x.image} style={s.drawImg} /> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {criteria.length > 0 && (
          <View wrap={false}>
            <SectionHead title="Criterios clínicos y operativos" />
            <View style={s.cards}>{criteria.map(([t, x]) => <View key={t} style={s.card}><Block title={t} text={x} /></View>)}</View>
          </View>
        )}

        {extra.length > 0 && (
          <View wrap={false}>
            <SectionHead title="Información complementaria" />
            <View style={s.cards}>{extra.map(([t, x]) => <View key={t} style={s.card}><Block title={t} text={x} /></View>)}</View>
          </View>
        )}

        {!d.approved && <Text style={s.draftNote}>VISTA PREVIA · Especificaciones pendientes de validación técnica.</Text>}

        <View style={s.footer} fixed>
          <View style={s.footRow}>
            <View>
              <Text style={s.footStrong}>{d.maker}</Text>
              <Text style={s.footSmall}>{d.brand}{d.brandSub ? ` ${d.brandSub}` : ""} · {d.website}</Text>
              <Text style={s.footSmall}>Versión {d.version} · Estado: {d.approved ? "APROBADO" : "NO APROBADO"}</Text>
            </View>
            <View>
              {d.productUrl ? <Link src={d.productUrl} style={s.footLink}>VER PRODUCTO EN LA WEB</Link> : null}
              <Text style={s.footRight}>{d.code} · V{d.version}</Text>
              <Text style={s.footRight} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export const renderDatasheetPdf = async (data: DatasheetData): Promise<Buffer> => {
  const lib = await loadLib()
  return lib.renderToBuffer(build(lib, data))
}
