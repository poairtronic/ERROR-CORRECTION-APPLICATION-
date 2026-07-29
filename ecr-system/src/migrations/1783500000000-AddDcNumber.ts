import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDcNumber1783500000000 implements MigrationInterface {
  name = 'AddDcNumber1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inspection_details" ADD COLUMN IF NOT EXISTS "dc_number" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inspection_details" DROP COLUMN IF EXISTS "dc_number"`,
    );
  }
}
