import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { buildPostgresSslConfig } from '../common/utils/postgres-ssl';

config();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: buildPostgresSslConfig(
    process.env.DATABASE_URL,
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
    process.env.NODE_ENV,
  ),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
