import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261112100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "project" (
      "id" text not null,
      "title" text not null,
      "slug" text not null,
      "line" text check ("line" in ('medico', 'veterinario', 'tecnico')) not null,
      "specialty" text null,
      "work_type" text null,
      "client_name" text null,
      "location" text null,
      "year" integer null,
      "summary" text null,
      "client_need" text null,
      "solution" text null,
      "fabrication" text null,
      "cover_url" text null,
      "cover_alt" text null,
      "gallery" jsonb not null default '[]',
      "related_product_ids" jsonb not null default '[]',
      "seo_title" text null,
      "seo_description" text null,
      "status" text check ("status" in ('draft', 'review', 'approved', 'published')) not null default 'draft',
      "published_at" timestamptz null,
      "sort_order" integer not null default 0,
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "project_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_project_slug_unique" ON "project" ("slug") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_project_deleted_at" ON "project" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "project_revision" (
      "id" text not null,
      "project_id" text not null,
      "action" text not null,
      "from_status" text null,
      "to_status" text null,
      "changes" jsonb null,
      "note" text null,
      "actor_id" text null,
      "actor_email" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "project_revision_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_project_revision_project_id" ON "project_revision" ("project_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_project_revision_deleted_at" ON "project_revision" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "project_revision" cascade;`)
    this.addSql(`drop table if exists "project" cascade;`)
  }
}
