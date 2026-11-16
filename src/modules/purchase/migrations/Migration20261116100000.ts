import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const base = `
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null`

export class Migration20261116100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "supplier" (
      "id" text not null, "name" text not null, "ruc" text null, "dv" text null, "contact_name" text null, "phone" text null, "email" text null,
      "address" text null, "payment_terms" text null, "notes" text null, "active" boolean not null default true,${base},
      constraint "supplier_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supplier_deleted_at" ON "supplier" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "purchase_item" (
      "id" text not null, "ref" text null, "name" text not null, "description" text null, "unit" text not null default 'Unidades', "category" text null,
      "last_price" numeric null, "last_supplier_id" text null, "last_supplier_name" text null, "last_bought_at" timestamptz null, "active" boolean not null default true,${base},
      constraint "purchase_item_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_item_deleted_at" ON "purchase_item" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "purchase_order" (
      "id" text not null, "number" text not null,
      "company" text check ("company" in ('fabmetal', 'karven')) not null,
      "status" text check ("status" in ('draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled')) not null default 'draft',
      "supplier_id" text null, "supplier_name" text not null, "supplier_ruc" text null, "supplier_contact" text null, "supplier_phone" text null, "supplier_email" text null, "supplier_address" text null,
      "ship_to_name" text null, "ship_to_address" text null, "ship_to_phone" text null,
      "order_date" timestamptz not null, "expected_date" timestamptz null, "payment_terms" text null, "currency" text not null default 'pab',
      "lines" jsonb not null default '[]', "subtotal" numeric not null default 0, "discount_total" numeric not null default 0, "tax_total" numeric not null default 0, "total" numeric not null default 0, "paid_total" numeric not null default 0,
      "notes_internal" text null, "invoice_reference" text null, "sent_at" timestamptz null, "confirmed_at" timestamptz null, "received_at" timestamptz null, "cancelled_at" timestamptz null, "last_pdf_url" text null, "metadata" jsonb null,${base},
      constraint "purchase_order_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_purchase_order_number_unique" ON "purchase_order" ("number") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_deleted_at" ON "purchase_order" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_company_status" ON "purchase_order" ("company", "status") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "purchase_receipt" (
      "id" text not null, "order_id" text not null, "received_at" timestamptz not null, "reference" text null, "lines" jsonb not null default '[]', "note" text null, "actor_email" text null,${base},
      constraint "purchase_receipt_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_receipt_order_id" ON "purchase_receipt" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_receipt_deleted_at" ON "purchase_receipt" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "purchase_payment" (
      "id" text not null, "order_id" text not null, "paid_at" timestamptz not null, "amount" numeric not null, "method" text null, "reference" text null, "note" text null, "actor_email" text null,${base},
      constraint "purchase_payment_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_payment_order_id" ON "purchase_payment" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_payment_deleted_at" ON "purchase_payment" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "purchase_event" (
      "id" text not null, "order_id" text not null, "action" text not null, "note" text null, "data" jsonb null, "actor_email" text null,${base},
      constraint "purchase_event_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_event_order_id" ON "purchase_event" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_event_deleted_at" ON "purchase_event" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "purchase_profile" (
      "id" text not null, "company" text not null, "number_prefix" text not null default 'P', "next_number" integer not null default 1,
      "ship_to_name" text null, "ship_to_address" text null, "ship_to_phone" text null, "payment_terms" text null, "tax_rate" numeric not null default 7, "email_signature" text null,${base},
      constraint "purchase_profile_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_purchase_profile_company_unique" ON "purchase_profile" ("company") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_profile_deleted_at" ON "purchase_profile" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    for (const t of ["purchase_profile", "purchase_event", "purchase_payment", "purchase_receipt", "purchase_order", "purchase_item", "supplier"]) this.addSql(`drop table if exists "${t}" cascade;`)
  }
}
