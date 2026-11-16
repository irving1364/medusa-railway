import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Quote numbers get a configurable width: KARVEN uses "KM-0001" (4 digits), FABMETAL keeps Odoo's "S00253" (5 digits). */
export class Migration20261116120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "quote_profile" add column if not exists "number_digits" integer not null default 4;`)
    this.addSql(`update "quote_profile" set "number_digits" = 5 where "store" = 'fabmetal';`)
    this.addSql(`update "quote_profile" set "number_prefix" = 'KM-' where "store" = 'karven' and "number_prefix" = 'KM';`)
    this.addSql(`update "quote" set "number" = 'KM-' || substring("number" from 4) where "store" = 'karven' and "number" like 'KM0%';`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "quote_profile" drop column if exists "number_digits";`)
  }
}
