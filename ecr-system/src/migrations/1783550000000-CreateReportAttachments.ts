import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportAttachments1783550000000 implements MigrationInterface {
  name = 'CreateReportAttachments1783550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS report_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES defect_reports(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        public_id VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size_bytes INTEGER,
        uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMP DEFAULT now(),
        created_at TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_report_attachments_report_id ON report_attachments(report_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_report_attachments_report_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS report_attachments`);
  }
}

