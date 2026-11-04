import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInlineQualityAndVendorQualityToResponsiblePartyEnum1783540000000 implements MigrationInterface {
  name = 'AddInlineQualityAndVendorQualityToResponsiblePartyEnum1783540000000';
  transactional = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'INLINE_QUALITY'`,
    );
    await queryRunner.query(
      `ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'VENDOR_QUALITY'`,
    );
    await queryRunner.query(
      `ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'DESIGN_TEAM'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support dropping a value from an enum type easily.
  }
}

