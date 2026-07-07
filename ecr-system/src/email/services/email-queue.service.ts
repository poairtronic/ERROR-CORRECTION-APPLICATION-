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
    this.logger.debug('Polling email queue...');
    
    // Fetch pending and failed emails (up to max retries)
    const emailsToProcess = await this.emailLogRepo.find({
      where: [
        { status: EmailStatus.PENDING },
        { status: EmailStatus.FAILED },
      ],
      take: 50, // process in batches
      order: { createdAt: 'ASC' },
    });

    const validEmails = emailsToProcess.filter(e => e.retryCount < this.maxRetries);

    if (validEmails.length === 0) return;

    this.logger.log(`Processing ${validEmails.length} emails from queue.`);

    const transporter = this.emailService.getTransporter();
    const fromAddress = this.configService.get<string>('EMAIL_FROM', 'noreply@example.com');

    for (const email of validEmails) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: email.recipient,
          cc: email.cc,
          bcc: email.bcc,
          subject: email.subject,
          html: email.isHtml ? email.content : undefined,
          text: !email.isHtml ? email.content : undefined,
        });

        email.status = EmailStatus.SENT;
        email.sentTime = new Date();
        this.logger.log(`Email ${email.id} sent successfully.`);
      } catch (error) {
        email.retryCount += 1;
        email.failureReason = error.message;
        email.status = email.retryCount >= this.maxRetries ? EmailStatus.CANCELLED : EmailStatus.FAILED;
        
        this.logger.error(`Failed to send email ${email.id}. Attempt ${email.retryCount}/${this.maxRetries}`, error.stack);
      } finally {
        await this.emailLogRepo.save(email);
      }
    }
  }
}
