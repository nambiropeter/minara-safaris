import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_supplier_status" AS ENUM('pending', 'booking', 'booked', 'failed', 'unknown', 'cancelled');
  CREATE TABLE "orders_supplier_cancellation_policies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"amount" numeric
  );
  
  ALTER TABLE "orders" ADD COLUMN "supplier_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_status" "enum_orders_supplier_status";
  ALTER TABLE "orders" ADD COLUMN "supplier_reference" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_client_reference" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_hotel_code" numeric;
  ALTER TABLE "orders" ADD COLUMN "supplier_hotel_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_room_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_board_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_check_in" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_check_out" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_guests" jsonb;
  ALTER TABLE "orders" ADD COLUMN "supplier_rate_key" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_net_amount" numeric;
  ALTER TABLE "orders" ADD COLUMN "supplier_booked_net_amount" numeric;
  ALTER TABLE "orders" ADD COLUMN "supplier_margin_bps" numeric;
  ALTER TABLE "orders" ADD COLUMN "supplier_fx_eur_per_kes" numeric;
  ALTER TABLE "orders" ADD COLUMN "supplier_fx_usd_per_kes" numeric;
  ALTER TABLE "orders" ADD COLUMN "supplier_rate_comments" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_payable_to" varchar;
  ALTER TABLE "orders" ADD COLUMN "supplier_note" varchar;
  ALTER TABLE "orders_supplier_cancellation_policies" ADD CONSTRAINT "orders_supplier_cancellation_policies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_supplier_cancellation_policies_order_idx" ON "orders_supplier_cancellation_policies" USING btree ("_order");
  CREATE INDEX "orders_supplier_cancellation_policies_parent_id_idx" ON "orders_supplier_cancellation_policies" USING btree ("_parent_id");
  CREATE INDEX "orders_supplier_supplier_status_idx" ON "orders" USING btree ("supplier_status");
  CREATE INDEX "orders_supplier_supplier_reference_idx" ON "orders" USING btree ("supplier_reference");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_supplier_cancellation_policies" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders_supplier_cancellation_policies" CASCADE;
  DROP INDEX "orders_supplier_supplier_status_idx";
  DROP INDEX "orders_supplier_supplier_reference_idx";
  ALTER TABLE "orders" DROP COLUMN "supplier_name";
  ALTER TABLE "orders" DROP COLUMN "supplier_status";
  ALTER TABLE "orders" DROP COLUMN "supplier_reference";
  ALTER TABLE "orders" DROP COLUMN "supplier_client_reference";
  ALTER TABLE "orders" DROP COLUMN "supplier_hotel_code";
  ALTER TABLE "orders" DROP COLUMN "supplier_hotel_name";
  ALTER TABLE "orders" DROP COLUMN "supplier_room_name";
  ALTER TABLE "orders" DROP COLUMN "supplier_board_name";
  ALTER TABLE "orders" DROP COLUMN "supplier_check_in";
  ALTER TABLE "orders" DROP COLUMN "supplier_check_out";
  ALTER TABLE "orders" DROP COLUMN "supplier_guests";
  ALTER TABLE "orders" DROP COLUMN "supplier_rate_key";
  ALTER TABLE "orders" DROP COLUMN "supplier_net_amount";
  ALTER TABLE "orders" DROP COLUMN "supplier_booked_net_amount";
  ALTER TABLE "orders" DROP COLUMN "supplier_margin_bps";
  ALTER TABLE "orders" DROP COLUMN "supplier_fx_eur_per_kes";
  ALTER TABLE "orders" DROP COLUMN "supplier_fx_usd_per_kes";
  ALTER TABLE "orders" DROP COLUMN "supplier_rate_comments";
  ALTER TABLE "orders" DROP COLUMN "supplier_payable_to";
  ALTER TABLE "orders" DROP COLUMN "supplier_note";
  DROP TYPE "public"."enum_orders_supplier_status";`)
}
