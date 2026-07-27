import { Logger as TypeOrmLoggerInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';
import { MonitoringService } from '../monitoring/monitoring.service';
import { PerformanceService } from '../monitoring/performance.service';

export class TypeOrmStructuredLogger implements TypeOrmLoggerInterface {
  private readonly logger = new Logger('DatabaseQuery');
  private readonly txStartTimes = new Map<QueryRunner, number>();

  constructor(
    private readonly monitoringService?: MonitoringService,
    private readonly performanceService?: PerformanceService,
  ) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    this.logger.debug({
      message: `Execute Query: ${query}`,
      parameters,
    });

    if (this.performanceService && typeof this.performanceService.recordDbQuery === 'function') {
      this.performanceService.recordDbQuery(query, parameters || [], 0, true);
    }

    if (queryRunner && (query.includes('START TRANSACTION') || query.includes('BEGIN'))) {
      this.txStartTimes.set(queryRunner, Date.now());
    }
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    this.logger.error({
      message: `Database Query Error: ${error instanceof Error ? error.message : error}`,
      query,
      parameters,
    }, error instanceof Error ? error.stack : undefined);

    if (this.performanceService && typeof this.performanceService.recordDbQuery === 'function') {
      this.performanceService.recordDbQuery(query, parameters || [], 0, false);
    }
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (this.monitoringService && typeof this.monitoringService.recordDbQuery === 'function') {
      this.monitoringService.recordDbQuery(time);
    }
    if (this.performanceService && typeof this.performanceService.recordDbQuery === 'function') {
      this.performanceService.recordDbQuery(query, parameters || [], time, true);
    }

    if (queryRunner && (query.includes('COMMIT') || query.includes('ROLLBACK'))) {
      const startTime = this.txStartTimes.get(queryRunner);
      if (startTime) {
        const txDuration = Date.now() - startTime;
        if (this.performanceService && typeof this.performanceService.recordTransaction === 'function') {
          this.performanceService.recordTransaction(txDuration);
        }
        this.txStartTimes.delete(queryRunner);
      }
    }

    const slowQueryThreshold = Number(process.env.SLOW_QUERY_THRESHOLD_MS) || 500;
    if (time > slowQueryThreshold) {
      this.logger.warn({
        message: `[SLOW_OPERATION] Slow DB Query detected (${time}ms): ${query}`,
        parameters,
        executionTimeMs: time,
        thresholdMs: slowQueryThreshold,
      });
    } else {
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
