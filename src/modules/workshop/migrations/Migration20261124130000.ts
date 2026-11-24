import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Materials needed by each work order (linked to the materials catalogue of Compras). */
export class Migration20261124130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "work_material" (
      "id" text not null, "order_id" text not null, "item_id" text null, "name" text not null, "unit" text not null default 'Unidades',
      "required" numeric not null default 1, "consumed" numeric not null default 0, "sort_order" integer not null default 0, "note" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "work_material_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_material_order_id" ON "work_material" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_material_item_id" ON "work_material" ("item_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_material_deleted_at" ON "work_material" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "work_material" cascade;`)
  }
}
