import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** How a mailbox sends: its own SMTP server, or the Resend API (Railway Hobby blocks outbound SMTP). */
export class Migration20261123100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "mail_account" add column if not exists "send_method" text check ("send_method" in ('smtp', 'resend')) not null default 'resend';`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "mail_account" drop column if exists "send_method";`)
  }
}
