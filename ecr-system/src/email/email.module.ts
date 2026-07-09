import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './entities/email-log.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { EmailTemplateService } from './services/email-template.service';
import { EmailService } from './services/email.service';
import { EmailQueueService } from './services/email-queue.service';
import { GmailSmtpService } from './services/gmail-smtp.service';
import { EmailController } from './email.controller';
import { NotificationsModule } from '../notifications/notifications.module'; // for NotificationsGateway

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailLog, NotificationPreference]),
    forwardRef(() => NotificationsModule),
  ],
  providers: [EmailTemplateService, EmailService, EmailQueueService, GmailSmtpService],
  controllers: [EmailController],
  exports: [EmailService, GmailSmtpService],
})
export class EmailModule {}
