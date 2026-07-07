import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { NotificationEvent } from './enums/notification-event.enum';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(@Body('to') to: string) {
    const email = await this.emailService.queueEmail({
      recipient: to || 'test@example.com',
      subject: 'Test Notification from ECR',
      event: NotificationEvent.REPORT_CREATED,
      templateData: {
        title: 'Test Email Successful',
        message: 'This is a plain test email to verify the infrastructure.',
      },
    });
    return { success: true, emailLogId: email.id };
  }

  @Post('test-html')
  @HttpCode(HttpStatus.OK)
  async sendTestHtmlEmail(@Body('to') to: string) {
    const email = await this.emailService.queueEmail({
      recipient: to || 'test@example.com',
      subject: 'HTML Test Notification',
      event: NotificationEvent.REPORT_UPDATED,
      templateData: {
        title: 'Welcome to Enterprise Notifications',
        message: 'This template confirms that HTML rendering is fully operational.',
        summaryTable: {
          'System Status': 'Online',
          'Database': 'Connected',
          'SMTP': 'Verified',
        },
        primaryButton: {
          text: 'View Dashboard',
          url: 'http://localhost:5173',
        },
      },
    });
    return { success: true, emailLogId: email.id };
  }
}
