import { Controller, Post, Get, Body, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { GmailSmtpService } from './services/gmail-smtp.service';
import { NotificationEvent } from './enums/notification-event.enum';
import { EmailStatus } from './enums/email-status.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly gmailSmtpService: GmailSmtpService,
  ) {}

  @Get('logs')
  getLogs() {
    return this.emailService.findAll();
  }

  @Get('health')
  async getHealth() {
    const isGas = this.gmailSmtpService.hasScriptUrl();
    let smtpConnected = false;
    let smtpVerified = false;
    let errorDetail: string | null = null;
    
    try {
      if (isGas) {
        smtpConnected = true;
        smtpVerified = true;
      } else {
        const transporter = this.gmailSmtpService.getTransporter();
        if (transporter) {
          await transporter.verify();
          smtpConnected = true;
          smtpVerified = true;
        } else {
          errorDetail = 'SMTP transport fallback is not initialized';
        }
      }
    } catch (e: any) {
      errorDetail = e.message;
    }

    const logs = await this.emailService.findAll();
    const total = logs.length;
    const sent = logs.filter(l => l.status === EmailStatus.SENT).length;
    const failed = logs.filter(l => l.status === EmailStatus.FAILED || l.status === EmailStatus.CANCELLED).length;
    const queued = logs.filter(l => l.status === EmailStatus.PENDING || l.status === EmailStatus.PROCESSING).length;
    const retries = logs.reduce((acc, curr) => acc + (curr.retryCount || 0), 0);

    // Latency averages
    const sentLogs = logs.filter(l => l.status === EmailStatus.SENT && l.sentTime);
    let avgSendTimeMs = 0;
    if (sentLogs.length > 0) {
      const totalDuration = sentLogs.reduce((acc, curr) => {
        const diff = curr.sentTime!.getTime() - curr.createdAt.getTime();
        return acc + diff;
      }, 0);
      avgSendTimeMs = Math.round(totalDuration / sentLogs.length);
    }
    
    const successRate = total > 0 ? Number(((sent / total) * 100).toFixed(2)) : 100;
    const lastEmail = logs[0] ? { id: logs[0].id, status: logs[0].status, recipient: logs[0].recipient } : null;

    return {
      smtpConnected,
      smtpVerified,
      provider: 'Gmail SMTP',
      queueWorking: true,
      lastEmail,
      successRate,
      errorDetail,
      metrics: {
        emailsSent: sent,
        emailsFailed: failed,
        queueLength: queued,
        averageSendTimeMs: avgSendTimeMs,
        retries,
        successRate,
      }
    };
  }

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

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async resendEmail(@Body('id') id: string) {
    const email = await this.emailService.resend(id);
    return { success: true, email };
  }

  @Get('template-preview/:template')
  async previewTemplate(@Param('template') template: string) {
    const sampleData = {
      employeeName: 'John Doe',
      role: 'Senior Manager',
      reportId: 'AGIPL-2026-ERR-00020',
      component: 'Digital Micrometer (0-25mm)',
      errorType: 'Calibration Drift',
      priority: 'HIGH',
      createdDate: new Date().toLocaleDateString('en-IN'),
      status: 'Awaiting Action',
      comments: 'Please verify the calibration standard error coefficients before signing off.',
      reviewer: 'Jane Smith',
      applicationUrl: 'http://localhost:5173/reports/uuid-1234',
      title: 'Sample Notification Title',
      message: 'This is a developer preview message designed to show template formatting in HTML format.',
    };

    const subject = `[ECR] Preview: ${template}`;
    try {
      const html = this.emailService.getTemplateService().renderHtml(template, sampleData, subject);
      return html;
    } catch (error: any) {
      return `<h3>Error Rendering Template: ${template}</h3><p>${error.message}</p>`;
    }
  }
}
