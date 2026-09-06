import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// migrate:create's diff also proposed adding articles.read_time_minutes/is_featured —
// those already exist in the DB via an earlier dev-push and were stripped from this
// migration by hand; only the orders/processed-events schema is new here.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_orders_items_kind" AS ENUM('package', 'hotel');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'paid', 'confirmed', 'cancelled', 'refunded', 'failed');
  CREATE TYPE "public"."enum_orders_currency" AS ENUM('KES', 'USD', 'GBP');
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_orders_items_kind" NOT NULL,
  	"ref_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"unit_amount" numeric NOT NULL,
  	"quantity" numeric NOT NULL,
  	"subtotal" numeric NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar NOT NULL,
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"customer_name" varchar,
  	"customer_email" varchar NOT NULL,
  	"customer_phone" varchar,
  	"currency" "enum_orders_currency" DEFAULT 'KES' NOT NULL,
  	"amount_total" numeric NOT NULL,
  	"travel_date" timestamp(3) with time zone,
  	"adults" numeric,
  	"children" numeric,
  	"stripe_checkout_session_id" varchar,
  	"stripe_payment_intent_id" varchar,
  	"access_token_hash" varchar,
  	"invoice_id" integer,
  	"staff_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "processed_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_id" varchar NOT NULL,
  	"type" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "processed_events_id" integer;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_id_media_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_customer_email_idx" ON "orders" USING btree ("customer_email");
  CREATE INDEX "orders_stripe_stripe_checkout_session_id_idx" ON "orders" USING btree ("stripe_checkout_session_id");
  CREATE UNIQUE INDEX "orders_access_token_hash_idx" ON "orders" USING btree ("access_token_hash");
  CREATE INDEX "orders_invoice_idx" ON "orders" USING btree ("invoice_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE UNIQUE INDEX "processed_events_event_id_idx" ON "processed_events" USING btree ("event_id");
  CREATE INDEX "processed_events_updated_at_idx" ON "processed_events" USING btree ("updated_at");
  CREATE INDEX "processed_events_created_at_idx" ON "processed_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_processed_events_fk" FOREIGN KEY ("processed_events_id") REFERENCES "public"."processed_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_processed_events_id_idx" ON "payload_locked_documents_rels" USING btree ("processed_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "processed_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "processed_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_processed_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  DROP INDEX "payload_locked_documents_rels_processed_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "processed_events_id";
  DROP TYPE "public"."enum_orders_items_kind";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_currency";`)
}
