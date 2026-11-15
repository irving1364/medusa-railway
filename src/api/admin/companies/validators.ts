import { z } from "zod"

const optText = (max: number) => z.string().max(max).nullable().optional()

export const UpdateCompanySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  brand_line: z.string().trim().min(1).max(120).optional(),
  legal_name: z.string().trim().min(1).max(200).optional(),
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
  from_email: optText(200),
  cc_email: optText(200),
  storefront_url: optText(200),
  color: optText(20),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
})
