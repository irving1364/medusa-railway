import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** "Plazo estimado": type (fabrication | delivery) and free text, printed under the dates of the quote. */
export class Migration20261120100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "quote" add column if not exists "lead_time_type" text not null default 'fabrication';`)
    this.addSql(`alter table "quote" add column if not exists "lead_time" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "quote" drop column if exists "lead_time";`)
    this.addSql(`alter table "quote" drop column if exists "lead_time_type";`)
  }
}
