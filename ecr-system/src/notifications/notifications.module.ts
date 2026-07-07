import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationListener } from './notification.listener';
import { NotificationRetryCron } from './notification-retry.cron';
import { NotificationsGateway } from './notifications.gateway';
import { SocketRegistryService } from './socket-registry.service';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, DefectReport]),
    forwardRef(() => EmailModule),
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationListener,
    NotificationRetryCron,
    NotificationsGateway,
    SocketRegistryService,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
