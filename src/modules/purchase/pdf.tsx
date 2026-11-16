import React from "react"
import { lineAmount, type PurchaseLine } from "./service"

type Loose = Record<string, any>
type PdfLib = typeof import("@react-pdf/renderer", { with: { "resolution-mode": "import" } })

let libPromise: Promise<PdfLib> | null = null
const loadLib = () => (libPromise ||= import("@react-pdf/renderer").then((lib) => { registerFonts(lib); return lib }))
const registerFonts = ({ Font }: PdfLib) => {
  Font.register({ family: "Montserrat", fonts: [
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-normal.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-italic.ttf", fontWeight: 400, fontStyle: "italic" },
    { src: "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-600-normal.ttf", fontWeight: 600 },
  ] })
  Font.registerHyphenationCallback((word) => [word])
}

const NAVY = "#2F4273", INK = "#1F2430", MUTED = "#5C6370", LINE = "#D9DEE7", SOFT = "#F3F5F9"

// No unitless lineHeight on the Page: it makes react-pdf drop `fixed` elements anchored with `bottom`.
const makeStyles = ({ StyleSheet }: PdfLib) => StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 70, paddingHorizontal: 40, fontFamily: "Montserrat", fontSize: 9, color: INK },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 118, backgroundColor: SOFT, borderBottomRightRadius: 220 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  brand: { fontSize: 12, fontWeight: 600, color: NAVY },
  tagline: { fontSize: 9, color: NAVY },
  taglineItalic: { fontSize: 9, color: NAVY, fontStyle: "italic" },
  legal: { fontSize: 8, color: MUTED, textAlign: "right", marginTop: 4 },
  logo: { width: 120, height: 44, objectFit: "contain", objectPosition: "right", alignSelf: "flex-end", marginBottom: 6 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, gap: 24 },
  party: { width: "48%", fontSize: 9, lineHeight: 1.45 },
  partyTitle: { fontWeight: 600, marginBottom: 2 },
  title: { fontSize: 20, color: NAVY, textAlign: "right", marginTop: 18, marginBottom: 12 },
  infoBox: { flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14, backgroundColor: SOFT },
  infoLabel: { fontSize: 8.5, color: MUTED },
  infoValue: { fontSize: 9.5 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: NAVY, color: "#FFFFFF", fontSize: 8.5 },
  th: { paddingVertical: 7, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: "#4B5C8C" },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  td: { paddingVertical: 7, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: LINE, lineHeight: 1.25 },
  descRow: { borderTopWidth: 1, borderTopColor: LINE, paddingVertical: 6, paddingHorizontal: 8 },
  desc: { fontStyle: "italic", fontSize: 8.5, lineHeight: 1.4 },
  cDesc: { width: "41%" }, cQty: { width: "9%", textAlign: "right" }, cPrice: { width: "13%", textAlign: "right" }, cDisc: { width: "8%", textAlign: "right" }, cTax: { width: "14%", textAlign: "right" }, cAmt: { width: "15%", textAlign: "right", borderRightWidth: 0 },
  totals: { marginTop: 12, marginLeft: "auto", width: "34%", borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: "hidden" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: LINE },
  totalMain: { backgroundColor: NAVY, color: "#FFFFFF", fontWeight: 600 },
  section: { marginTop: 14 },
  h: { fontSize: 9.5, fontWeight: 600, marginBottom: 3 },
  p: { fontSize: 9, lineHeight: 1.4 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 26, borderTopWidth: 1, borderTopColor: INK, paddingTop: 8, fontSize: 8.5, textAlign: "center", color: INK },
  footerLink: { color: NAVY },
  pageNo: { fontSize: 8, color: MUTED, marginTop: 4 },
})

const num = (n: number) => { const v = Math.round((Number(n) || 0) * 100) / 100; const [i, f = ""] = Math.abs(v).toFixed(2).split("."); return `${v < 0 ? "-" : ""}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f}` }
const money = (n: number) => `${num(n)} B/.`
const pct = (n: number) => String(Math.round((Number(n) || 0) * 100) / 100)
const date = (d: string | Date | null | undefined) => { if (!d) return "—"; const t = new Date(new Date(d).getTime() - 5 * 3600000); return `${String(t.getUTCDate()).padStart(2, "0")}/${String(t.getUTCMonth() + 1).padStart(2, "0")}/${t.getUTCFullYear()}` }
const lines = (t: string | null | undefined) => (t || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

/** The purchase order document, laid out like the Odoo template the client uses (P00016). */
const build = (lib: PdfLib) => {
  const { Document, Image, Page, Text, View } = lib
  const s = makeStyles(lib)
  const PurchaseDocument = ({ order, profile }: { order: Loose; profile: Loose }) => {
    const o = order
    const items = (o.lines || []) as PurchaseLine[]
    const rates = [...new Set(items.map((l) => Number(l.tax_rate) || 0).filter((r) => r > 0))]
    const taxLabel = rates.length === 1 ? `ITBMS ${pct(rates[0])}%` : "ITBMS"
    const buyer = profile.company?.name || profile.brand_line
    return (
      <Document title={`Orden de compra ${o.number}`} author={profile.legal_name || buyer} subject={o.supplier_name}>
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

          <View style={s.parties}>
            <View style={s.party}>
              <Text style={s.partyTitle}>Dirección de envío</Text>
              <Text>{o.ship_to_name || buyer}</Text>
              {lines(o.ship_to_address).map((t, i) => <Text key={i}>{t}</Text>)}
              {o.ship_to_phone ? <Text>Tel. {o.ship_to_phone}</Text> : null}
            </View>
            <View style={s.party}>
              <Text style={s.partyTitle}>{o.supplier_name}</Text>
              {lines(o.supplier_address).map((t, i) => <Text key={i}>{t}</Text>)}
              {o.supplier_contact ? <Text>Atención: {o.supplier_contact}</Text> : null}
              {o.supplier_phone ? <Text>Tel. {o.supplier_phone}</Text> : null}
              {o.supplier_email ? <Text>{o.supplier_email}</Text> : null}
              {o.supplier_ruc ? <Text>RUC: {o.supplier_ruc}</Text> : null}
            </View>
          </View>

          <Text style={s.title}>Orden de compra #{o.number}</Text>

          <View style={s.infoBox}>
            <View style={{ flex: 2 }}><Text style={s.infoLabel}>Comprador</Text><Text style={s.infoValue}>{buyer}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.infoLabel}>Fecha de la orden:</Text><Text style={s.infoValue}>{date(o.order_date)}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.infoLabel}>Llegada esperada:</Text><Text style={s.infoValue}>{date(o.expected_date)}</Text></View>
          </View>

          <View style={s.table}>
            <View style={s.thead}>
              <Text style={[s.th, s.cDesc]}>DESCRIPCIÓN</Text>
              <Text style={[s.th, s.cQty]}>CANT.</Text>
              <Text style={[s.th, s.cPrice]}>PRECIO UNITARIO</Text>
              <Text style={[s.th, s.cDisc]}>DESC.</Text>
              <Text style={[s.th, s.cTax]}>IMPUESTOS</Text>
              <Text style={[s.th, s.cAmt]}>IMPORTE</Text>
            </View>
            {items.map((l, i) => (
              <View key={l.id || i}>
                <View style={s.row} wrap={false}>
                  <View style={[s.td, s.cDesc]}><Text>{l.ref ? `[${l.ref}] ` : ""}{l.title}</Text></View>
                  <View style={[s.td, s.cQty]}><Text>{num(l.quantity)}</Text>{l.unit && l.unit !== "Unidades" ? <Text style={{ color: MUTED, fontSize: 8 }}>{l.unit}</Text> : null}</View>
                  <View style={[s.td, s.cPrice]}><Text>{num(l.unit_price)}</Text></View>
                  <View style={[s.td, s.cDisc]}><Text>{pct(l.discount_pct)}%</Text></View>
                  <View style={[s.td, s.cTax]}><Text>{l.tax_rate ? `ITBMS ${pct(l.tax_rate)}%` : "Exento"}</Text><Text style={{ color: MUTED, fontSize: 8 }}>Compra</Text></View>
                  <View style={[s.td, s.cAmt]}><Text>{money(lineAmount(l))}</Text></View>
                </View>
                {l.description ? <View style={s.descRow}>{lines(l.description).map((t, k) => <Text key={k} style={s.desc}>{t}</Text>)}</View> : null}
              </View>
            ))}
          </View>

          <View style={s.totals} wrap={false}>
            <View style={[s.totalRow, { borderTopWidth: 0 }]}><Text>Subtotal</Text><Text>{money(o.subtotal)}</Text></View>
            {o.discount_total > 0 ? <View style={s.totalRow}><Text>Descuentos</Text><Text>-{money(o.discount_total)}</Text></View> : null}
            <View style={[s.totalRow, { backgroundColor: SOFT }]}><Text>{taxLabel}</Text><Text>{money(o.tax_total)}</Text></View>
            <View style={[s.totalRow, s.totalMain]}><Text>Total</Text><Text>{money(o.total)}</Text></View>
          </View>

          <View style={s.section} wrap={false}>
            <Text style={s.h}>Términos de pago:</Text>
            {lines(o.payment_terms).map((t, i) => <Text key={i} style={s.p}>{t}</Text>)}
          </View>

          <View style={s.footer} fixed>
            <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap" }}>
              {[profile.website ? { t: String(profile.website), link: true } : null, profile.email ? { t: String(profile.email), link: true } : null, profile.whatsapp ? { t: `Whatsapp: ${profile.whatsapp}`, link: false } : null]
                .filter((x): x is { t: string; link: boolean } => !!x)
                .map((x, i, arr) => <Text key={i} style={x.link ? s.footerLink : undefined}>{x.t}{i < arr.length - 1 ? "  |  " : ""}</Text>)}
            </View>
            <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      </Document>
    )
  }
  return PurchaseDocument
}

export const renderPurchasePdf = async (order: Loose, profile: Loose): Promise<Buffer> => {
  const lib = await loadLib()
  const PurchaseDocument = build(lib)
  return lib.renderToBuffer(<PurchaseDocument order={order} profile={profile} />)
}
