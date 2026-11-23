import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Mail accounts (IMAP/SMTP mailboxes per company). Messages stay on the mail server. */
export class Migration20261122100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "mail_account" (
      "id" text not null,
      "company" text check ("company" in ('fabmetal', 'karven')) not null default 'karven',
      "label" text not null, "email" text not null, "display_name" text null,
      "imap_host" text not null, "imap_port" integer not null default 993, "imap_secure" boolean not null default true,
      "smtp_host" text not null, "smtp_port" integer not null default 465, "smtp_secure" boolean not null default true,
      "username" text not null, "password_enc" text not null, "signature" text null,
      "active" boolean not null default true, "sort_order" integer not null default 0,
      "last_check_at" timestamptz null, "last_error" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
      constraint "mail_account_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_mail_account_deleted_at" ON "mail_account" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_mail_account_company" ON "mail_account" ("company") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "mail_account" cascade;`)
  }
}
