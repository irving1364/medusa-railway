import { z } from "zod"

const optText = (max: number) => z.string().max(max).nullable().optional()
const dateish = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))

export const SupplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ruc: optText(80), dv: optText(10), contact_name: optText(200), phone: optText(80), email: optText(200), address: optText(400), payment_terms: optText(1000), notes: optText(2000),
  active: z.boolean().optional(),
})
export const UpdateSupplierSchema = SupplierSchema.partial()

export const ItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  ref: optText(80), description: optText(2000), unit: z.string().max(40).optional(), category: optText(120),
  last_price: z.number().min(0).nullable().optional(),
  active: z.boolean().optional(),
})
export const UpdateItemSchema = ItemSchema.partial()

export const PurchaseLineSchema = z.object({
  id: z.string().min(1).max(60),
  item_id: z.string().max(60).nullable().optional(),
  ref: optText(80),
  title: z.string().trim().min(1).max(300),
  description: optText(2000),
  quantity: z.number().min(0).max(1000000),
  unit: z.string().max(40).default("Unidades"),
  unit_price: z.number().min(0).max(100000000),
  discount_pct: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).max(100).default(7),
  received_qty: z.number().min(0).optional(),
})

export const PurchaseOrderSchema = z.object({
  company: z.enum(["fabmetal", "karven"]),
  supplier_id: optText(60),
  supplier_name: z.string().trim().min(1).max(200),
  supplier_ruc: optText(80), supplier_contact: optText(200), supplier_phone: optText(80), supplier_email: optText(200), supplier_address: optText(400),
  ship_to_name: optText(200), ship_to_address: optText(400), ship_to_phone: optText(80),
  order_date: dateish.optional(),
  expected_date: dateish.nullable().optional(),
  payment_terms: optText(2000),
  lines: z.array(PurchaseLineSchema).max(300).default([]),
  notes_internal: optText(4000),
  invoice_reference: optText(120),
  metadata: z.record(z.unknown()).nullable().optional(),
})
export const CreatePurchaseOrderSchema = PurchaseOrderSchema
export const UpdatePurchaseOrderSchema = PurchaseOrderSchema.partial()

export const PurchaseStatusSchema = z.object({ status: z.enum(["draft", "sent", "confirmed", "cancelled"]), note: optText(1000) })
export const SendPurchaseSchema = z.object({ to: z.array(z.string().email()).min(1).max(10), cc: z.array(z.string().email()).max(10).optional(), subject: z.string().trim().min(1).max(200), message: z.string().max(6000) })
export const ReceiptSchema = z.object({
  received_at: dateish.optional(),
  reference: optText(120),
  note: optText(1000),
  lines: z.array(z.object({ line_id: z.string().min(1), quantity: z.number().min(0).max(1000000) })).min(1),
})
export const PaymentSchema = z.object({
  paid_at: dateish.optional(),
  amount: z.number().positive().max(100000000),
  method: optText(60),
  reference: optText(120),
  note: optText(1000),
})
export const PurchaseProfileSchema = z.object({
  number_prefix: z.string().max(10).optional(),
  next_number: z.number().int().min(1).max(10000000).optional(),
  ship_to_name: optText(200), ship_to_address: optText(400), ship_to_phone: optText(80), payment_terms: optText(2000),
  tax_rate: z.number().min(0).max(100).optional(),
  email_signature: optText(2000),
})
