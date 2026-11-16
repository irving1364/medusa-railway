import React from "react"
import { lineAmount, type QuoteLine } from "./service"

type Loose = Record<string, any>
type PdfLib = typeof import("@react-pdf/renderer", { with: { "resolution-mode": "import" } })

// @react-pdf/renderer ships as ESM only; the backend is CommonJS, so it is loaded once with a dynamic import.
let libPromise: Promise<PdfLib> | null = null
const loadLib = () => (libPromise ||= import("@react-pdf/renderer").then((lib) => { registerFonts(lib); return lib }))

// Montserrat, like the Odoo template; fetched once per process from the fontsource CDN.
const registerFonts = ({ Font }: PdfLib) => { Font.register({
  family: "Montserrat",
  fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-italic.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-600-normal.ttf", fontWeight: 600 },
  ],
}); Font.registerHyphenationCallback((word) => [word]) }

const DEFAULT_ACCENT = "#2F4273"
const INK = "#1F2430"
const MUTED = "#5C6370"
const LINE = "#D9DEE7"
const SOFT = "#F3F5F9"

const makeStyles = ({ StyleSheet }: PdfLib, NAVY: string) => StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 70, paddingHorizontal: 40, fontFamily: "Montserrat", fontSize: 9, color: INK },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 118, backgroundColor: SOFT, borderBottomRightRadius: 220 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  brand: { fontSize: 12, fontWeight: 600, color: NAVY },
  tagline: { fontSize: 9, color: NAVY },
  taglineItalic: { fontSize: 9, color: NAVY, fontStyle: "italic" },
  legal: { fontSize: 8, color: MUTED, textAlign: "right", marginTop: 4 },
  logo: { width: 120, height: 44, objectFit: "contain", objectPosition: "right", alignSelf: "flex-end", marginBottom: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20, marginBottom: 14 },
  customer: { fontSize: 10 },
  customerSub: { fontSize: 8.5, color: MUTED },
  titleBlock: { alignItems: "flex-end" },
  titleLabel: { fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: "uppercase" },
  titleNumber: { fontSize: 22, fontWeight: 600, color: NAVY },
  titleCompany: { fontSize: 10, color: MUTED, marginTop: 2 },
  infoBox: { flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14 },
  infoCell: { flex: 1 },
  infoLabel: { fontSize: 8.5, color: MUTED },
  infoValue: { fontSize: 9.5 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: NAVY, color: "#FFFFFF", fontSize: 8.5 },
  th: { paddingVertical: 7, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.35)" },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  td: { paddingVertical: 7, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: LINE, lineHeight: 1.25 },
  descRow: { borderTopWidth: 1, borderTopColor: LINE, paddingVertical: 8, paddingHorizontal: 8 },
  desc: { fontStyle: "italic", fontSize: 8.5, color: INK, lineHeight: 1.4 },
  cDesc: { width: "46%" }, cQty: { width: "11%", textAlign: "right" }, cPrice: { width: "14%", textAlign: "right" }, cTax: { width: "13%", textAlign: "right" }, cAmt: { width: "16%", textAlign: "right", borderRightWidth: 0 },
  totals: { marginTop: 18, marginLeft: "auto", width: "48%", borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: LINE },
  totalMain: { backgroundColor: NAVY, color: "#FFFFFF", fontWeight: 600 },
  section: { marginTop: 14 },
  h: { fontSize: 9.5, fontWeight: 600, marginBottom: 4 },
  p: { fontSize: 9, lineHeight: 1.4 },
  li: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 12, textAlign: "center" },
  footer: { position: "absolute", left: 40, right: 40, bottom: 26, borderTopWidth: 1, borderTopColor: INK, paddingTop: 8, fontSize: 8.5, textAlign: "center", color: INK },
  footerLink: { color: NAVY },
  pageNo: { fontSize: 8, color: MUTED, marginTop: 4 },
})

/** 3,500.00 (Panamanian convention: comma thousands, point decimals) without relying on ICU locale data. */
const num = (n: number) => { const v = Math.round((Number(n) || 0) * 100) / 100; const [i, f = ""] = Math.abs(v).toFixed(2).split("."); return `${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f}` }
const money = (n: number) => `$ ${num(n)}`
const pct = (n: number) => String(Math.round((Number(n) || 0) * 100) / 100)
/** dd/mm/yyyy in Panama time */
const date = (d: string | Date | null | undefined) => { if (!d) return "—"; const t = new Date(new Date(d).getTime() - 5 * 3600000); return `${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${t.getUTCFullYear()}` }
const lines = (t: string | null | undefined) => (t || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

/** The quotation document, laid out like the Odoo template the client uses. */
/** Accent colour per company (Empresas › Color); falls back to the Odoo navy. */
const accentOf = (profile: Loose) => (/^#[0-9a-f]{6}$/i.test(String(profile.company?.color || "")) ? String(profile.company.color) : DEFAULT_ACCENT)

const build = (lib: PdfLib, accent: string) => {
  const { Document, Image, Page, Text, View } = lib
  const s = makeStyles(lib, accent)
  const Bullets = ({ text }: { text: string | null | undefined }) => (
  <View>
    {lines(text).map((l, i) => (
      <View key={i} style={s.li}><Text style={s.bullet}>•</Text><Text style={[s.p, { flex: 1 }]}>{l}</Text></View>
    ))}
  </View>
)

  const QuoteDocument = ({ quote, profile }: { quote: Loose; profile: Loose }) => {
  const q = quote
  const items = (q.lines || []) as QuoteLine[]
  const taxRates = [...new Set(items.map((l) => Number(l.tax_rate) || 0).filter((r) => r > 0))]
  const taxLabel = taxRates.length === 1 ? `ITBMS ${taxRates[0]}%` : "ITBMS"
  return (
    <Document title={`Cotización ${q.number}`} author={profile.company_name} subject={q.customer_name}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <View style={s.header} fixed>
          <View>
            <Text style={s.brand}>{profile.brand_line}</Text>
            {lines(profile.tagline).map((t, i) => <Text key={i} style={i === 0 ? s.tagline : s.taglineItalic}>{t}</Text>)}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {profile.logo_url ? <Image src={profile.logo_url} style={s.logo} /> : null}
            {profile.ruc ? <Text style={s.legal}><Text style={{ fontWeight: 600, color: INK }}>R.U.C. </Text>{profile.ruc}</Text> : null}
            {profile.address ? <Text style={s.legal}>{profile.address}</Text> : null}
          </View>
        </View>

        <View style={s.titleRow}>
          <View>
            <Text style={s.customer}>{q.customer_name}</Text>
            {q.customer_company ? <Text style={s.customerSub}>{q.customer_company}</Text> : null}
            {q.customer_ruc ? <Text style={s.customerSub}>{/^d{1,2}-d/.test(String(q.customer_ruc)) || String(q.customer_ruc).length <= 9 ? "Cédula / R.U.C." : "R.U.C."} {q.customer_ruc}</Text> : null}
            {q.contact_name ? <Text style={s.customerSub}>Atención: {q.contact_name}</Text> : null}
            {q.customer_address ? <Text style={s.customerSub}>{q.customer_address}</Text> : null}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.titleLabel}>Cotización N.º</Text>
            <Text style={s.titleNumber}>{q.number}{q.version > 1 ? ` · v${q.version}` : ""}</Text>
            <Text style={s.titleCompany}>{profile.company?.name || profile.brand_line}</Text>
          </View>
        </View>

        <View style={s.infoBox}>
          <View style={s.infoCell}><Text style={s.infoLabel}>Fecha de cotización</Text><Text style={s.infoValue}>{date(q.issue_date)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLabel}>Vencimiento</Text><Text style={s.infoValue}>{date(q.valid_until)}</Text></View>
          <View style={s.infoCell}><Text style={s.infoLabel}>Vendedor</Text><Text style={s.infoValue}>{q.salesperson || profile.brand_line.split("|")[0].trim()}</Text></View>
        </View>

        {q.intro_text ? <Text style={[s.p, { marginBottom: 10 }]}>{q.intro_text}</Text> : null}

        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, s.cDesc]}>DESCRIPCIÓN</Text>
            <Text style={[s.th, s.cQty]}>CANTIDAD</Text>
            <Text style={[s.th, s.cPrice]}>PRECIO UNITARIO</Text>
            <Text style={[s.th, s.cTax]}>IMPUESTOS</Text>
            <Text style={[s.th, s.cAmt]}>IMPORTE</Text>
          </View>
          {items.map((l, i) => (
            <View key={l.id || i}>
              <View style={s.row} wrap={false}>
                <View style={[s.td, s.cDesc]}><Text>{l.ref ? `[${l.ref}] ` : ""}{l.title}</Text></View>
                <View style={[s.td, s.cQty]}><Text>{num(l.quantity)}</Text><Text style={{ color: MUTED, fontSize: 8 }}>{l.unit}</Text></View>
                <View style={[s.td, s.cPrice]}><Text>{money(l.unit_price)}</Text>{l.discount_pct ? <Text style={{ color: MUTED, fontSize: 8 }}>-{pct(l.discount_pct)}%</Text> : null}</View>
                <View style={[s.td, s.cTax]}><Text>{l.tax_rate ? `ITBMS ${pct(l.tax_rate)}%` : "Exento"}</Text><Text style={{ color: MUTED, fontSize: 8 }}>Venta</Text></View>
                <View style={[s.td, s.cAmt]}><Text>{money(lineAmount(l))}</Text></View>
              </View>
              {l.description ? (
                <View style={s.descRow}>
                  {lines(l.description).map((t, k) => <Text key={k} style={[s.desc, k > 0 ? { marginTop: 3 } : {}]}>{t}</Text>)}
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={[s.totalRow, { borderTopWidth: 0 }]}><Text>Subtotal</Text><Text>{money(q.subtotal)}</Text></View>
          {q.discount_total > 0 ? <View style={s.totalRow}><Text>Descuentos aplicados</Text><Text>-{money(q.discount_total)}</Text></View> : null}
          <View style={[s.totalRow, { backgroundColor: SOFT }]}><Text>{taxLabel}</Text><Text>{money(q.tax_total)}</Text></View>
          <View style={[s.totalRow, s.totalMain]}><Text>Total</Text><Text>{money(q.total)}</Text></View>
        </View>

        {profile.bank_name || profile.bank_account_number ? (
          <View style={s.section} wrap={false}>
            <Text style={s.h}>Datos bancarios:</Text>
            {profile.bank_name ? <Text style={s.p}><Text style={{ fontWeight: 600 }}>Banco: </Text>{profile.bank_name}</Text> : null}
            {profile.bank_holder ? <Text style={s.p}><Text style={{ fontWeight: 600 }}>Titular de la cuenta: </Text>{profile.bank_holder}</Text> : null}
            {profile.bank_account_type ? <Text style={s.p}><Text style={{ fontWeight: 600 }}>Tipo de cuenta: </Text>{profile.bank_account_type}</Text> : null}
            {profile.bank_account_number ? <Text style={s.p}><Text style={{ fontWeight: 600 }}>Número de cuenta: </Text>{profile.bank_account_number}</Text> : null}
          </View>
        ) : null}
        {q.warranty_text ? <View style={s.section} wrap={false}><Text style={s.h}>Garantía</Text><Text style={s.p}>{q.warranty_text}</Text></View> : null}
        {q.payment_terms ? <View style={s.section} wrap={false}><Text style={s.h}>Condiciones de pago</Text><Bullets text={q.payment_terms} /></View> : null}
        {q.general_terms ? <View style={s.section} wrap={false}><Text style={s.h}>Condiciones generales</Text><Bullets text={q.general_terms} /></View> : null}

        <View style={s.footer} fixed>
          <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap" }}>
            {[profile.website ? { t: String(profile.website), link: true } : null, profile.email ? { t: String(profile.email), link: true } : null, profile.whatsapp ? { t: `Whatsapp: ${profile.whatsapp}`, link: false } : null]
              .filter((x): x is { t: string; link: boolean } => !!x)
              .map((x, i, arr) => (
                <Text key={i} style={x.link ? s.footerLink : undefined}>{x.t}{i < arr.length - 1 ? "  |  " : ""}</Text>
              ))}
          </View>
          <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

  return QuoteDocument
}

export const renderQuotePdf = async (quote: Loose, profile: Loose): Promise<Buffer> => {
  const lib = await loadLib()
  const QuoteDocument = build(lib, accentOf(profile))
  return lib.renderToBuffer(<QuoteDocument quote={quote} profile={profile} />)
}
