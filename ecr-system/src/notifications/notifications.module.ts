import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationListener } from './notification.listener';
import { NotificationRetryCron } from './notification-retry.cron';
import { NotificationsGateway } from './notifications.gateway';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    forwardRef(() => EmailModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationListener,
    NotificationRetryCron,
    NotificationsGateway,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
