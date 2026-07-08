import { MigrationInterface, QueryRunner } from "typeorm";

export class HistoryAndIndexes1783488677821 implements MigrationInterface {
    name = 'HistoryAndIndexes1783488677821'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "login_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "ipAddress" character varying, "userAgent" character varying, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fe377f36d49c39547cb6b9f0727" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ad9ce49cb73c0b33746a56b6bd" ON "login_history" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_55cbd7208766b265ea1985e82d" ON "login_history" ("timestamp") `);
        await queryRunner.query(`ALTER TABLE "login_history" ADD CONSTRAINT "FK_ad9ce49cb73c0b33746a56b6bd1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "login_history" DROP CONSTRAINT "FK_ad9ce49cb73c0b33746a56b6bd1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_55cbd7208766b265ea1985e82d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad9ce49cb73c0b33746a56b6bd"`);
        await queryRunner.query(`DROP TABLE "login_history"`);
    }

}
