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
    const fromAddress = this.configService.get<string>('EMAIL_FROM');
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
          // [STEP 9] sendMail Started & TASK 7 Diagnostics (Before sendMail)
          console.log(`[EMAIL_DIAGNOSTICS] [STEP 9] sendMail Started: Sending Email ID ${email.id} (Attempt: ${attempt}/${maxAttempts})`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SEND] Recipient: ${email.recipient}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SEND] Subject: ${email.subject}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SEND] EMAIL_FROM: ${fromAddress}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SEND] SMTP_USER: ${smtpUser}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SEND] SMTP_HOST: ${smtpHost}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SEND] SMTP_PORT: ${smtpPort}`);
          
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

          // TASK 7 Diagnostics (After sendMail)
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SUCCESS] Message ID: ${info.messageId}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SUCCESS] SMTP Response: ${info.response}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SUCCESS] Accepted: ${JSON.stringify(info.accepted)}`);
          console.log(`[EMAIL_DIAGNOSTICS] [SMTP_SUCCESS] Rejected: ${JSON.stringify(info.rejected)}`);

          email.status = EmailStatus.SENT;
          email.sentTime = new Date();
          email.failureReason = null as any;
          sentSuccess = true;
          break; // break the retry loop
        } catch (error) {
          lastError = error;
          const endTime = Date.now();
          const connectionTime = endTime - startTime;

          // TASK 7 Diagnostics (On failure)
          console.error(
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] SMTP Error Code: ${error.code || 'N/A'}\n` +
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] SMTP Response Code: ${error.responseCode || 'N/A'}\n` +
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] Full Error Message: ${error.message}\n` +
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] Stack Trace: ${error.stack}\n` +
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] EmailLog ID: ${email.id}\n` +
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] Recipient: ${email.recipient}\n` +
            `[EMAIL_DIAGNOSTICS] [SMTP_ERROR] Subject: ${email.subject}`
          );

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
