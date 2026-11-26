import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailProcessingAndResetEnums1783560000000 implements MigrationInterface {
  name = 'AddEmailProcessingAndResetEnums1783560000000';
  transactional = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statusEnumRows = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'email_logs_status_enum'`,
    );
    if (Array.isArray(statusEnumRows) && statusEnumRows.length > 0) {
      await queryRunner.query(
        `ALTER TYPE "public"."email_logs_status_enum" ADD VALUE IF NOT EXISTS 'PROCESSING'`,
      );
    }

    const eventEnumRows = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'email_logs_event_enum'`,
    );
    if (Array.isArray(eventEnumRows) && eventEnumRows.length > 0) {
      await queryRunner.query(
        `ALTER TYPE "public"."email_logs_event_enum" ADD VALUE IF NOT EXISTS 'PasswordReset'`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "providerMessageId" character varying`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_logs_status_createdAt" ON "email_logs" ("status", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_rate_limit_state" (
        "key" character varying NOT NULL,
        "windowStart" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(),
        "dispatchedCount" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_email_rate_limit_state" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "email_rate_limit_state" ("key", "windowStart", "dispatchedCount")
      VALUES ('global', clock_timestamp() - interval '60 seconds', 0)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Additive enum values ('PROCESSING', 'PasswordReset') are preserved because
    // PostgreSQL does not support removing enum values safely in place.
  }
}
