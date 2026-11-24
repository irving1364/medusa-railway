import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const base = `
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null`

export class Migration20261124100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "work_order" (
      "id" text not null, "number" text not null,
      "company" text check ("company" in ('fabmetal', 'karven')) not null default 'fabmetal',
      "type" text check ("type" in ('fabrication', 'repair', 'maintenance')) not null default 'fabrication',
      "title" text not null, "description" text null, "client_name" text null, "customer_id" text null, "quote_id" text null, "quote_number" text null,
      "quantity" integer not null default 1, "due_date" text null, "finish_date" text null,
      "priority" text check ("priority" in ('low', 'normal', 'high', 'urgent')) not null default 'normal',
      "stage" text check ("stage" in ('preparation', 'scheduled', 'in_progress', 'inspection', 'released', 'delivered', 'closed', 'cancelled')) not null default 'preparation',
      "materials" text check ("materials" in ('pending', 'partial', 'complete')) not null default 'pending', "materials_note" text null,
      "owner_id" text null, "blocked" boolean not null default false, "blocker" text null, "blocked_since" timestamptz null,
      "next_action" text null, "notes" text null, "checklist" jsonb null,
      "inspected_at" timestamptz null, "inspected_by" text null, "released_at" timestamptz null, "delivered_at" timestamptz null, "delivery_note" text null, "closed_at" timestamptz null,
      "metadata" jsonb null,${base},
      constraint "work_order_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_work_order_number_unique" ON "work_order" ("number") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_order_deleted_at" ON "work_order" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_order_company_stage" ON "work_order" ("company", "stage") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "work_activity" (
      "id" text not null, "order_id" text not null, "name" text not null, "date" text null, "resource_id" text null,
      "hours" numeric not null default 1, "actual_hours" numeric null,
      "status" text check ("status" in ('pending', 'in_progress', 'done')) not null default 'pending',
      "sort_order" integer not null default 0, "notes" text null,
      ${base},
      constraint "work_activity_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_activity_order_id" ON "work_activity" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_activity_date" ON "work_activity" ("date") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_activity_deleted_at" ON "work_activity" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "workshop_resource" (
      "id" text not null, "name" text not null, "role" text null,
      "weekly_capacity" numeric not null default 40, "daily_capacity" numeric not null default 9,
      "active" boolean not null default true, "sort_order" integer not null default 0,${base},
      constraint "workshop_resource_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_workshop_resource_deleted_at" ON "workshop_resource" ("deleted_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "work_event" (
      "id" text not null, "order_id" text not null, "action" text not null, "note" text null, "data" jsonb null, "actor_email" text null,${base},
      constraint "work_event_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_event_order_id" ON "work_event" ("order_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_work_event_deleted_at" ON "work_event" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "work_event" cascade;`)
    this.addSql(`drop table if exists "workshop_resource" cascade;`)
    this.addSql(`drop table if exists "work_activity" cascade;`)
    this.addSql(`drop table if exists "work_order" cascade;`)
  }
}
