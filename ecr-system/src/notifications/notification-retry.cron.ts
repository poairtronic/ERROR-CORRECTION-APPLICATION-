import { Injectable, Logger, BeforeApplicationShutdown } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { runWithTraceContext } from '../common/trace-context';
import { MonitoringService } from '../monitoring/monitoring.service';
import * as crypto from 'crypto';

@Injectable()
export class NotificationRetryCron implements BeforeApplicationShutdown {
  private readonly logger = new Logger(NotificationRetryCron.name);
  private isProcessing = false;
  private isShuttingDown = false;

  constructor(
    private notificationsService: NotificationsService,
    private monitoringService: MonitoringService,
  ) {}

  async beforeApplicationShutdown() {
    this.logger.log('Graceful shutdown initiated. Preventing new notification retry jobs and draining current runs...');
    this.isShuttingDown = true;
    const shutdownTimeout = 10000;
    const started = Date.now();
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (Date.now() - started > shutdownTimeout) {
        this.logger.warn('Notification retry drain timed out after 10s, forcing shutdown.');
        break;
      }
    }
    this.logger.log('Notification retry cron drained successfully.');
  }

  // Runs every minute. Retries FAILED notifications up to 3 attempts.
  @Cron('0 * * * * *')
  async handleRetry() {
    const traceCtx = {
      correlationId: `cron-notif-retry-${crypto.randomUUID()}`,
      requestId: crypto.randomUUID(),
    };

    return runWithTraceContext(traceCtx, async () => {
      if (this.isShuttingDown) {
        this.logger.log('Notification retry requested but system is shutting down. Skipping execution.');
        return;
      }
      this.isProcessing = true;
      const start = Date.now();
      try {
        const result = await this.notificationsService.retryFailed(3);
        const duration = Date.now() - start;
        this.monitoringService.recordQueueProcessingTime(duration);

        const slowNotifProcThreshold = Number(process.env.SLOW_NOTIFICATION_THRESHOLD_MS) || 1000;
        if (duration > slowNotifProcThreshold) {
          this.logger.warn(`[SLOW_OPERATION] Slow notification retry queue processing detected (${duration}ms)`);
        }

        if (result.retried > 0) {
          this.logger.log(`Retried ${result.retried} failed notifications`);
        }
      } catch (err: any) {
        this.logger.error(`Notification retry cron execution failed: ${err.message}`, err.stack);
      } finally {
        this.isProcessing = false;
      }
    });
  }
}
