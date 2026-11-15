import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261115200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "quote" (
      "id" text not null,
      "number" text not null,
      "store" text check ("store" in ('fabmetal', 'karven')) not null,
      "status" text check ("status" in ('draft', 'sent', 'approved', 'rejected')) not null default 'draft',
      "version" integer not null default 1,
      "customer_id" text null,
      "customer_name" text not null,
      "customer_company" text null,
      "customer_ruc" text null,
      "customer_email" text null,
      "customer_phone" text null,
      "customer_address" text null,
      "contact_name" text null,
      "issue_date" timestamptz not null,
      "valid_until" timestamptz null,
      "salesperson" text null,
      "currency" text not null default 'pab',
      "lines" jsonb not null default '[]',
      "subtotal" numeric not null default 0,
      "discount_total" numeric not null default 0,
      "tax_total" numeric not null default 0,
      "total" numeric not null default 0,
      "intro_text" text null,
      "warranty_text" text null,
      "payment_terms" text null,
      "general_terms" text null,
      "notes_internal" text null,
      "order_id" text null,
      "sent_at" timestamptz null,
      "approved_at" timestamptz null,
      "rejected_at" timestamptz null,
      "last_pdf_url" text null,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "quote_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quote_number_unique" ON "quote" ("number") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_deleted_at" ON "quote" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_store_status" ON "quote" ("store", "status") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "quote_revision" (
      "id" text not null,
      "quote_id" text not null,
      "version" integer not null,
      "action" text not null,
      "snapshot" jsonb not null,
      "pdf_url" text null,
      "sent_to" text null,
      "note" text null,
      "actor_email" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "quote_revision_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_revision_quote_id" ON "quote_revision" ("quote_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_revision_deleted_at" ON "quote_revision" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "quote_profile" (
      "id" text not null,
      "store" text not null,
      "brand_line" text not null,
      "company_name" text not null,
      "tagline" text null,
      "ruc" text null,
      "address" text null,
      "website" text null,
      "email" text null,
      "whatsapp" text null,
      "logo_url" text null,
      "bank_name" text null,
      "bank_holder" text null,
      "bank_account_type" text null,
      "bank_account_number" text null,
      "warranty_text" text null,
      "payment_terms" text null,
      "general_terms" text null,
      "number_prefix" text not null default 'S',
      "next_number" integer not null default 1,
      "validity_days" integer not null default 30,
      "tax_rate" numeric not null default 7,
      "from_email" text null,
      "cc_email" text null,
      "email_signature" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "quote_profile_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quote_profile_store_unique" ON "quote_profile" ("store") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quote_profile_deleted_at" ON "quote_profile" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "quote_revision" cascade;`)
    this.addSql(`drop table if exists "quote_profile" cascade;`)
    this.addSql(`drop table if exists "quote" cascade;`)
  }
}
