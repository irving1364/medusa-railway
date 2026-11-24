import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Photo evidence per work order, and the originally committed delivery date (for on-time reports). */
export class Migration20261124140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "work_photo" (
      "id" text not null, "order_id" text not null,
      "kind" text check ("kind" in ('progress', 'inspection', 'delivery', 'issue')) not null default 'progress',
      "url" text not null, "file_id" text null, "caption" text null, "width" integer null, "height" integer null, "actor_email" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "work_photo_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_photo_order_id" ON "work_photo" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_photo_deleted_at" ON "work_photo" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`alter table if exists "work_order" add column if not exists "original_due_date" text null;`)
    this.addSql(`update "work_order" set "original_due_date" = "due_date" where "original_due_date" is null and "due_date" is not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "work_order" drop column if exists "original_due_date";`)
    this.addSql(`drop table if exists "work_photo" cascade;`)
  }
}
