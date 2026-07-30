import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectorDraftStatus1783520000000 implements MigrationInterface {
  name = 'AddInspectorDraftStatus1783520000000';
  transactional = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE defect_reports_status_enum ADD VALUE IF NOT EXISTS 'INSPECTOR_DRAFT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support dropping a value from an enum type easily.
  }
}
