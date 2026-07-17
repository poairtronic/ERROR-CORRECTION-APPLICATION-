import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { runWithTraceContext } from '../common/trace-context';
import { MonitoringService } from '../monitoring/monitoring.service';
import * as crypto from 'crypto';

@Injectable()
export class NotificationRetryCron {
  private readonly logger = new Logger(NotificationRetryCron.name);

  constructor(
    private notificationsService: NotificationsService,
    private monitoringService: MonitoringService,
  ) {}

  // Runs every minute. Retries FAILED notifications up to 3 attempts.
  @Cron('0 * * * * *')
  async handleRetry() {
    const traceCtx = {
      correlationId: `cron-notif-retry-${crypto.randomUUID()}`,
      requestId: crypto.randomUUID(),
    };

    return runWithTraceContext(traceCtx, async () => {
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
      }
    });
  }
}
