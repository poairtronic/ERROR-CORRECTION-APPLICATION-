import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly maxRetries: number;

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.maxRetries = this.configService.get<number>('EMAIL_MAX_RETRIES', 3);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processEmailQueue() {
    // [STEP 5] Queue Processing
    console.log('[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Polling email queue...');
    
    let emailsToProcess: EmailLog[];
    try {
      emailsToProcess = await this.emailLogRepo.find({
        where: [
          { status: EmailStatus.PENDING },
          { status: EmailStatus.FAILED },
        ],
        take: 50,
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to query pending emails from database.\nReason: ${error.message}\nFile: email-queue.service.ts\nMethod: processEmailQueue\nStack: ${error.stack}`);
      throw error;
    }

    const validEmails = emailsToProcess.filter(e => e.retryCount < this.maxRetries);
    if (validEmails.length === 0) return;

    console.log(`[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Found ${validEmails.length} pending emails to send.`);

    const transporter = this.emailService.getTransporter();
    const fromAddress = this.configService.get<string>('EMAIL_FROM', 'noreply@example.com');
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpPort = this.configService.get('SMTP_PORT');
    const smtpUser = this.configService.get('SMTP_USER');

    // [STEP 7] SMTP Verify
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 7] SMTP Verify: Checking connection to SMTP server (${smtpHost}:${smtpPort})...`);
    try {
      await transporter.verify();
      // [STEP 8] SMTP Connected
      console.log(`[EMAIL_DIAGNOSTICS] [STEP 8] SMTP Connected: Connection verified successfully (Authenticated as ${smtpUser}).`);
    } catch (error) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] SMTP Connection Verification Failed.\nReason: ${error.message}\nFile: email-queue.service.ts\nMethod: processEmailQueue\nStack: ${error.stack}\nConfig: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}`);
      // Update logs as failed
      for (const email of validEmails) {
        email.retryCount += 1;
        email.failureReason = `SMTP Verification failed: ${error.message}`;
        email.status = email.retryCount >= this.maxRetries ? EmailStatus.CANCELLED : EmailStatus.FAILED;
        await this.emailLogRepo.save(email);
      }
      return;
    }

    for (const email of validEmails) {
      try {
        // [STEP 9] sendMail Started
        console.log(`[EMAIL_DIAGNOSTICS] [STEP 9] sendMail Started: Sending Email ID ${email.id} (Recipient: ${email.recipient}, From: ${fromAddress})`);
        
        const info = await transporter.sendMail({
          from: fromAddress,
          to: email.recipient,
          cc: email.cc,
          bcc: email.bcc,
          subject: email.subject,
          html: email.isHtml ? email.content : undefined,
          text: !email.isHtml ? email.content : undefined,
        });

        // [STEP 10] Brevo Response & [STEP 11] Message ID & [STEP 12] Email Delivered
        console.log(`[EMAIL_DIAGNOSTICS] [STEP 10] Brevo Response: ${info.response}`);
        console.log(`[EMAIL_DIAGNOSTICS] [STEP 11] Message ID: ${info.messageId}`);
        console.log(`[EMAIL_DIAGNOSTICS] [STEP 12] Email Delivered: Status set to SENT for Email ID ${email.id}`);

        email.status = EmailStatus.SENT;
        email.sentTime = new Date();
      } catch (error) {
        email.retryCount += 1;
        email.failureReason = error.message;
        email.status = email.retryCount >= this.maxRetries ? EmailStatus.CANCELLED : EmailStatus.FAILED;
        
        console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] sendMail Failed for Email ID ${email.id}.\nReason: ${error.message}\nFile: email-queue.service.ts\nMethod: sendMail\nStack: ${error.stack}\nConfig: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}, sender=${fromAddress}`);
      } finally {
        await this.emailLogRepo.save(email);
      }
    }
  }
}
