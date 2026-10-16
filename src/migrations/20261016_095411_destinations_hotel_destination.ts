import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_destinations_hotel_destination" AS ENUM('nairobi', 'maasai-mara', 'mombasa', 'diani', 'nakuru', 'naivasha', 'amboseli', 'tsavo', 'lamu', 'malindi', 'zanzibar', 'arusha', 'serengeti', 'ngorongoro', 'dar-es-salaam');
  ALTER TABLE "destinations" ADD COLUMN "hotel_destination" "enum_destinations_hotel_destination";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "destinations" DROP COLUMN "hotel_destination";
  DROP TYPE "public"."enum_destinations_hotel_destination";`)
}
