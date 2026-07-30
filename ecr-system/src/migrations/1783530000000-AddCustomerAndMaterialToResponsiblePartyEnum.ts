import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerAndMaterialToResponsiblePartyEnum1783530000000 implements MigrationInterface {
  name = 'AddCustomerAndMaterialToResponsiblePartyEnum1783530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'CUSTOMER'`,
    );
    await queryRunner.query(
      `ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'MATERIAL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support dropping a value from an enum type easily.
  }
}
