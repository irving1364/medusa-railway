import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261115210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "company" (
      "id" text not null,
      "code" text not null,
      "name" text not null,
      "brand_line" text not null,
      "legal_name" text not null,
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
      "from_email" text null,
      "cc_email" text null,
      "sales_channel_id" text null,
      "storefront_url" text null,
      "color" text null,
      "active" boolean not null default true,
      "sort_order" integer not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "company_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_company_code_unique" ON "company" ("code") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_deleted_at" ON "company" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "company" cascade;`)
  }
}
