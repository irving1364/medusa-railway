import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261115100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "material" (
      "id" text not null,
      "name" text not null,
      "active" boolean not null default true,
      "sort_order" integer not null default 0,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "material_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_deleted_at" ON "material" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "product_redirect" (
      "id" text not null,
      "from_handle" text not null,
      "to_handle" text not null,
      "product_id" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "product_redirect_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_redirect_from_handle_unique" ON "product_redirect" ("from_handle") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_redirect_deleted_at" ON "product_redirect" ("deleted_at") WHERE deleted_at IS NULL;`)

    // Starting list of materials from the product specification; the admin can edit or disable them
    const names = ["Acero inoxidable AISI 304", "Acero inoxidable AISI 316", "Acero al carbono pintado", "Acero galvanizado pintado", "Aluminio"]
    names.forEach((name, i) => {
      this.addSql(`insert into "material" ("id", "name", "active", "sort_order") select 'mat_seed_${i + 1}', '${name}', true, ${(i + 1) * 10} where not exists (select 1 from "material" where "name" = '${name}' and deleted_at is null);`)
    })
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_redirect" cascade;`)
    this.addSql(`drop table if exists "material" cascade;`)
  }
}
