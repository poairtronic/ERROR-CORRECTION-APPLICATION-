import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class BrevoClientService implements OnModuleInit {
  private readonly logger = new Logger(BrevoClientService.name);
  private client: BrevoClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    const emailFromName = this.configService.get<string>('EMAIL_FROM_NAME');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!apiKey) {
      throw new Error('Email startup validation failed: Missing required environment variable [BREVO_API_KEY]');
    }
    if (!emailFrom) {
      throw new Error('Email startup validation failed: Missing required environment variable [EMAIL_FROM]');
    }
    if (!emailFromName) {
      throw new Error('Email startup validation failed: Missing required environment variable [EMAIL_FROM_NAME]');
    }
    if (!frontendUrl) {
      throw new Error('Email startup validation failed: Missing required environment variable [FRONTEND_URL]');
    }

    this.client = new BrevoClient({ apiKey });
    this.logger.log('Brevo Transactional SDK client initialized successfully.');
  }

  getClient(): BrevoClient {
    return this.client;
  }
}
