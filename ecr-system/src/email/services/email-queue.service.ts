import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly maxRetries: number;

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private emailService: EmailService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.maxRetries = 3; // Official SDK requirement: 3 retries
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
        order: { createdAt: 'ASC' },
      });
    } catch (error: any) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to query pending emails from database.\nReason: ${error.message}\nFile: email-queue.service.ts\nMethod: processEmailQueue\nStack: ${error.stack}`);
      throw error;
    }

    console.log("Emails fetched from DB:", emailsToProcess.length);

    // Filter by backoff delays (Retry Engine)
    const eligibleEmails: EmailLog[] = [];
    const retryDelays = [2, 5, 15]; // delays in seconds for retry count 1, 2, 3

    for (const email of emailsToProcess) {
      if (email.status === EmailStatus.PENDING) {
        eligibleEmails.push(email);
      } else if (email.status === EmailStatus.FAILED) {
        const secondsPassed = (Date.now() - email.updatedAt.getTime()) / 1000;
        const requiredDelay = retryDelays[email.retryCount - 1] || 15;
        if (secondsPassed >= requiredDelay) {
          eligibleEmails.push(email);
        }
      }
    }

    // Limit to at most 5 emails per minute (Rate Limit)
    const validEmails = eligibleEmails.slice(0, 5);
    if (validEmails.length === 0) return;

    console.log(`[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Found ${validEmails.length} eligible emails to process.`);
    console.log(`[EMAIL] [Queue Started] [${new Date().toISOString()}] Processing batch of size ${validEmails.length}`);

    const isRetryableError = (error: any): boolean => {
      if (error.status) {
        const transientStatuses = [429, 500, 502, 503, 504];
        return transientStatuses.includes(error.status);
      }
      const errorMessage = error.message ? error.message.toLowerCase() : '';
      return (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'EPIPE' ||
        error.code === 'TIMEOUT' ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network')
      );
    };

    for (const email of validEmails) {
      email.status = EmailStatus.PROCESSING;
      await this.emailLogRepo.save(email);
      this.eventEmitter.emit('email.logs.updated');
      console.log(`[EMAIL] [Queue Picked] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | Status: PROCESSING`);

      let attempt = 0;
      const maxAttempts = 3;
      let delay = 1000; // start with 1 second delay
      let sentSuccess = false;
      let lastError: any = null;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          const apiResult = await this.emailService.sendEmailViaApi(email);

          email.status = EmailStatus.SENT;
          email.sentTime = new Date();
          email.providerMessageId = apiResult.messageId;
          email.failureReason = JSON.stringify({
            providerName: 'Gmail SMTP',
            responseCode: apiResult.responseCode,
            responseBody: apiResult.responseBody,
            deliveryTime: email.sentTime.toISOString(),
          });

          sentSuccess = true;
          break;
        } catch (error) {
          lastError = error;

          const retryable = isRetryableError(error);
          console.error(
            `[EMAIL] [Failure] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
            `Attempt: ${attempt}/${maxAttempts} | Error: ${error.message} | Retryable: ${retryable}`
          );

          if (retryable && attempt < maxAttempts) {
            console.log(`[EMAIL] [Retry] [${new Date().toISOString()}] Email ID: ${email.id} | Waiting ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
          } else {
            break;
          }
        }
      }

      if (!sentSuccess) {
        const retryable = isRetryableError(lastError);
        email.retryCount += 1;
        
        const statusCode = lastError.status || 'N/A';
        email.failureReason = JSON.stringify({
          providerName: 'Gmail SMTP',
          error: lastError.message,
          responseCode: statusCode,
          responseBody: lastError.message,
          stackTrace: lastError.stack || 'N/A',
          deliveryTime: null,
        });

        if (!retryable || email.retryCount >= this.maxRetries) {
          email.status = EmailStatus.CANCELLED;
          console.error(
            `[EMAIL] [Failure] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
            `Action: CANCELLED | Reason: Non-retryable error or exceeded max attempts`
          );
        } else {
          email.status = EmailStatus.FAILED;
          console.log(
            `[EMAIL] [Retry] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
            `Action: RETRY_SCHEDULED | Attempt: ${email.retryCount}/${this.maxRetries}`
          );
        }
      }

      // [STEP 12] Database Updated
      await this.emailLogRepo.save(email);
      console.log(`[EMAIL] [Database Updated] [${new Date().toISOString()}] Email ID: ${email.id} | Status: ${email.status}`);
      this.eventEmitter.emit('email.logs.updated');
    }
  }
}
