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

    console.log("Emails fetched from DB:", emailsToProcess.length);

    emailsToProcess.forEach(e => {
      console.log(
        e.id,
        e.status,
        e.retryCount,
        e.recipient
      );
    });

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
      let attempt = 0;
      const maxAttempts = 3;
      let delay = 1000; // start with 1 second delay
      let sentSuccess = false;
      let lastError: any = null;
      const startTime = Date.now();

      while (attempt < maxAttempts) {
        attempt++;
        try {
          // [STEP 9] sendMail Started
          console.log(`[EMAIL_DIAGNOSTICS] [STEP 9] sendMail Started: Sending Email ID ${email.id} (Recipient: ${email.recipient}, From: ${fromAddress}, Attempt: ${attempt}/${maxAttempts})`);
          
          const info = await transporter.sendMail({
            from: fromAddress,
            to: email.recipient,
            cc: email.cc,
            bcc: email.bcc,
            subject: email.subject,
            html: email.isHtml ? email.content : undefined,
            text: !email.isHtml ? email.content : undefined,
          });

          const endTime = Date.now();
          const connectionTime = endTime - startTime;

          // [STEP 10] Brevo Response & [STEP 11] Message ID & [STEP 12] Email Delivered
          console.log(`[EMAIL_DIAGNOSTICS] [STEP 10] Brevo Response: ${info.response}`);
          console.log(`[EMAIL_DIAGNOSTICS] [STEP 11] Message ID: ${info.messageId}`);
          console.log(`[EMAIL_DIAGNOSTICS] [STEP 12] Email Delivered: Status set to SENT for Email ID ${email.id}`);

          // Diagnostics requirements:
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP Host: ${smtpHost}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP Port: ${smtpPort}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP User: ${smtpUser}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] Connection Time: ${connectionTime}ms`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] Queue Size: ${validEmails.length}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] Recipient: ${email.recipient}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] Subject: ${email.subject}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] Brevo Response: ${info.response}`);
          console.log(`[EMAIL_DIAGNOSTICS] [DIAG] Message ID: ${info.messageId}`);

          email.status = EmailStatus.SENT;
          email.sentTime = new Date();
          email.failureReason = null as any;
          sentSuccess = true;
          break; // break the retry loop
        } catch (error) {
          lastError = error;
          const endTime = Date.now();
          const connectionTime = endTime - startTime;

          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP Host: ${smtpHost}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP Port: ${smtpPort}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP User: ${smtpUser}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] Connection Time: ${connectionTime}ms`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] Queue Size: ${validEmails.length}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] Recipient: ${email.recipient}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] Subject: ${email.subject}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP Error Code: ${error.code || 'N/A'}`);
          console.error(`[EMAIL_DIAGNOSTICS] [DIAG] SMTP Response Code: ${error.responseCode || 'N/A'}`);

          const retryable =
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'EPIPE' ||
            error.code === 'TIMEOUT' ||
            (error.message && error.message.toLowerCase().includes('timeout'));

          if (retryable && attempt < maxAttempts) {
            console.warn(`[EMAIL_DIAGNOSTICS] [RETRY] Retryable error encountered. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
          } else {
            break; // not retryable or max attempts reached
          }
        }
      }

      if (!sentSuccess) {
        email.retryCount += 1;
        email.failureReason = lastError ? lastError.message : 'Unknown error';
        email.status = email.retryCount >= this.maxRetries ? EmailStatus.CANCELLED : EmailStatus.FAILED;

        console.error(
          `[EMAIL_DIAGNOSTICS] [FAILURE] sendMail Failed for Email ID ${email.id} after ${attempt} attempts.\n` +
          `Reason: ${email.failureReason}\n` +
          `File: email-queue.service.ts\n` +
          `Method: sendMail\n` +
          `Stack: ${lastError ? lastError.stack : ''}\n` +
          `Config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}, sender=${fromAddress}`
        );
      }

      await this.emailLogRepo.save(email);
    }
  }
}
