import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Projects belong to a company (karven by default: everything published so far is on karvenmedical.com). */
export class Migration20261115211000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "project" add column if not exists "company" text not null default 'karven';`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_project_company" ON "project" ("company") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "project" drop column if exists "company";`)
  }
}
