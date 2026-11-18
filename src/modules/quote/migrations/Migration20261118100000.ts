import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Customer portal (public link, views, responses) and conversion to a Medusa order. */
export class Migration20261118100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "quote" add column if not exists "public_token" text null;`)
    this.addSql(`alter table "quote" add column if not exists "viewed_at" timestamptz null;`)
    this.addSql(`alter table "quote" add column if not exists "view_count" integer not null default 0;`)
    this.addSql(`alter table "quote" add column if not exists "responded_at" timestamptz null;`)
    this.addSql(`alter table "quote" add column if not exists "response_name" text null;`)
    this.addSql(`alter table "quote" add column if not exists "response_comment" text null;`)
    this.addSql(`alter table "quote" add column if not exists "changes_requested_at" timestamptz null;`)
    this.addSql(`alter table "quote" add column if not exists "converted_at" timestamptz null;`)
    this.addSql(`alter table "quote" add column if not exists "order_display_id" integer null;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quote_public_token_unique" ON "quote" ("public_token") WHERE deleted_at IS NULL AND public_token IS NOT NULL;`)
  }

  override async down(): Promise<void> {
    for (const c of ["public_token", "viewed_at", "view_count", "responded_at", "response_name", "response_comment", "changes_requested_at", "converted_at", "order_display_id"]) this.addSql(`alter table "quote" drop column if exists "${c}";`)
  }
}
