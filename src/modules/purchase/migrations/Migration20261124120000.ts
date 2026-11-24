import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Stock of materials (purchase_item) and its movements. */
export class Migration20261124120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "purchase_item" add column if not exists "stock" numeric not null default 0;`)
    this.addSql(`alter table if exists "purchase_item" add column if not exists "min_stock" numeric null;`)
    this.addSql(`create table if not exists "stock_movement" (
      "id" text not null, "item_id" text not null, "quantity" numeric not null, "balance" numeric not null,
      "reason" text check ("reason" in ('receipt', 'consumption', 'return', 'adjustment')) not null,
      "ref_type" text null, "ref_id" text null, "ref_label" text null, "note" text null, "actor_email" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "stock_movement_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_stock_movement_item_id" ON "stock_movement" ("item_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_stock_movement_deleted_at" ON "stock_movement" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "stock_movement" cascade;`)
    this.addSql(`alter table if exists "purchase_item" drop column if exists "min_stock";`)
    this.addSql(`alter table if exists "purchase_item" drop column if exists "stock";`)
  }
}
