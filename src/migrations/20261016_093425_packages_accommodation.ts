import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_packages_accommodation" AS ENUM('included', 'choose-your-own');
  ALTER TABLE "packages" ADD COLUMN "accommodation" "enum_packages_accommodation" DEFAULT 'included' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "packages" DROP COLUMN "accommodation";
  DROP TYPE "public"."enum_packages_accommodation";`)
}
