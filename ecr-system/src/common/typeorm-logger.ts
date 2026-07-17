import { Logger as TypeOrmLoggerInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';
import { MonitoringService } from '../monitoring/monitoring.service';

export class TypeOrmStructuredLogger implements TypeOrmLoggerInterface {
  private readonly logger = new Logger('DatabaseQuery');

  constructor(private readonly monitoringService: MonitoringService) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    // Normal query logging to debug level to prevent flooding console in production
    this.logger.debug({
      message: `Execute Query: ${query}`,
      parameters,
    });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    this.logger.error({
      message: `Database Query Error: ${error instanceof Error ? error.message : error}`,
      query,
      parameters,
    }, error instanceof Error ? error.stack : undefined);
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    // Record execution time to monitoring service
    this.monitoringService.recordDbQuery(time);

    const slowQueryThreshold = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 500;
    if (time > slowQueryThreshold) {
      this.logger.warn({
        message: `[SLOW_OPERATION] Slow DB Query detected (${time}ms): ${query}`,
        parameters,
        executionTimeMs: time,
        thresholdMs: slowQueryThreshold,
      });
    } else {
      // Still log the query at debug level if it was under threshold
      this.logger.debug({
        message: `Execute Query: ${query} (${time}ms)`,
        parameters,
      });
    }
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    this.logger.log({ message: `Schema build: ${message}` });
  }

  logMigration(message: string, queryRunner?: QueryRunner) {
    this.logger.log({ message: `Migration: ${message}` });
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    if (level === 'warn') {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
