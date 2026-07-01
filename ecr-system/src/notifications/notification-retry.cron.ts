import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationRetryCron {
  private readonly logger = new Logger(NotificationRetryCron.name);

  constructor(private notificationsService: NotificationsService) {}

  // Runs every minute. Retries FAILED notifications up to 3 attempts.
  // Interval matches NOTIFICATION_RETRY_INTERVAL_MIN in .env (kept simple/fixed here for Phase 1).
  @Cron('0 * * * * *')
  async handleRetry() {
    const result = await this.notificationsService.retryFailed(3);
    if (result.retried > 0) {
      this.logger.log(`Retried ${result.retried} failed notifications`);
    }
  }
}
