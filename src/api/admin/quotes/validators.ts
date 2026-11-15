import { z } from "zod"

export const QuoteLineSchema = z.object({
  id: z.string().min(1).max(60),
  ref: z.string().max(80).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  quantity: z.number().min(0).max(1000000),
  unit: z.string().max(40).default("Unidades"),
  unit_price: z.number().min(0).max(100000000),
  discount_pct: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).max(100).default(7),
  product_id: z.string().max(60).nullable().optional(),
  variant_id: z.string().max(60).nullable().optional(),
})

const optText = (max: number) => z.string().max(max).nullable().optional()

export const QuoteBodySchema = z.object({
  store: z.enum(["fabmetal", "karven"]),
  customer_id: optText(60),
  customer_name: z.string().trim().min(1).max(200),
  customer_company: optText(200),
  customer_ruc: optText(80),
  customer_email: optText(200),
  customer_phone: optText(80),
  customer_address: optText(400),
  contact_name: optText(200),
  issue_date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  valid_until: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  salesperson: optText(120),
  lines: z.array(QuoteLineSchema).max(200).default([]),
  intro_text: optText(2000),
  warranty_text: optText(2000),
  payment_terms: optText(4000),
  general_terms: optText(6000),
  notes_internal: optText(4000),
  metadata: z.record(z.unknown()).nullable().optional(),
})

export const CreateQuoteSchema = QuoteBodySchema
export const UpdateQuoteSchema = QuoteBodySchema.partial()

export const QuoteStatusSchema = z.object({
  status: z.enum(["draft", "sent", "approved", "rejected"]),
  note: z.string().max(1000).nullable().optional(),
})

export const SendQuoteSchema = z.object({
  to: z.array(z.string().email()).min(1).max(10),
  cc: z.array(z.string().email()).max(10).optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().max(6000),
})

export const ProfileSchema = z.object({
  brand_line: z.string().trim().min(1).max(120).optional(),
  company_name: z.string().trim().min(1).max(200).optional(),
  tagline: optText(300),
  ruc: optText(80),
  address: optText(300),
  website: optText(200),
  email: optText(200),
  whatsapp: optText(120),
  logo_url: optText(500),
  bank_name: optText(120),
  bank_holder: optText(200),
  bank_account_type: optText(60),
  bank_account_number: optText(80),
  warranty_text: optText(2000),
  payment_terms: optText(4000),
  general_terms: optText(6000),
  number_prefix: z.string().max(10).optional(),
  next_number: z.number().int().min(1).max(10000000).optional(),
  validity_days: z.number().int().min(1).max(365).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  from_email: optText(200),
  cc_email: optText(200),
  email_signature: optText(2000),
})
