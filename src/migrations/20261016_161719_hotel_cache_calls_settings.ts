import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_hotel_calls_kind" AS ENUM('availability', 'checkrate', 'booking');
  CREATE TABLE "hotel_cache" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"body" jsonb NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "hotel_calls" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_hotel_calls_kind" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "hotel_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"margin_percent" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "hotel_cache_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "hotel_calls_id" integer;
  CREATE UNIQUE INDEX "hotel_cache_key_idx" ON "hotel_cache" USING btree ("key");
  CREATE INDEX "hotel_cache_expires_at_idx" ON "hotel_cache" USING btree ("expires_at");
  CREATE INDEX "hotel_cache_updated_at_idx" ON "hotel_cache" USING btree ("updated_at");
  CREATE INDEX "hotel_cache_created_at_idx" ON "hotel_cache" USING btree ("created_at");
  CREATE INDEX "hotel_calls_kind_idx" ON "hotel_calls" USING btree ("kind");
  CREATE INDEX "hotel_calls_updated_at_idx" ON "hotel_calls" USING btree ("updated_at");
  CREATE INDEX "hotel_calls_created_at_idx" ON "hotel_calls" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_hotel_cache_fk" FOREIGN KEY ("hotel_cache_id") REFERENCES "public"."hotel_cache"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_hotel_calls_fk" FOREIGN KEY ("hotel_calls_id") REFERENCES "public"."hotel_calls"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_hotel_cache_id_idx" ON "payload_locked_documents_rels" USING btree ("hotel_cache_id");
  CREATE INDEX "payload_locked_documents_rels_hotel_calls_id_idx" ON "payload_locked_documents_rels" USING btree ("hotel_calls_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "hotel_cache" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "hotel_calls" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "hotel_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "hotel_cache" CASCADE;
  DROP TABLE "hotel_calls" CASCADE;
  DROP TABLE "hotel_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_hotel_cache_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_hotel_calls_fk";
  
  DROP INDEX "payload_locked_documents_rels_hotel_cache_id_idx";
  DROP INDEX "payload_locked_documents_rels_hotel_calls_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "hotel_cache_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "hotel_calls_id";
  DROP TYPE "public"."enum_hotel_calls_kind";`)
}
