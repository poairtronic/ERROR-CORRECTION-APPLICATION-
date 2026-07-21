import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DefectReportsModule } from './defect-reports/defect-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MasterDataModule } from './master-data/master-data.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MonitoringService } from './monitoring/monitoring.service';
import { TypeOrmStructuredLogger } from './common/typeorm-logger';

import { ComponentIssueModule } from './component-issue/component-issue.module';
import { VendorFaultModule } from './vendor-fault/vendor-fault.module';
import { SalaryDeductionModule } from './salary-deduction/salary-deduction.module';
import { ImageUploadModule } from './image-upload/image-upload.module';
import { AnalyticsModule } from './analytics/analytics.module';

import { EmailModule } from './email/email.module';
import { EmailMonitoringModule } from './email-monitoring/email-monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production'
        ? ['.env.production', '.env']
        : ['.env.development', '.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production'
        && !existsSync(join(process.cwd(), '.env.production'))
        && !existsSync(join(process.cwd(), '.env')),
      validate: (config: Record<string, any>) => {
        const requiredAlways = ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_FROM'];
        for (const key of requiredAlways) {
          if (!config[key] || config[key].trim() === '') {
            throw new Error(`[ENVIRONMENT_ERROR] Mandatory configuration key "${key}" is missing or empty in environment!`);
          }
        }

        const gmailScriptUrl = config['GMAIL_SCRIPT_URL'];
        const hasScriptToken = !!(config['GMAIL_SCRIPT_TOKEN'] && config['GMAIL_SCRIPT_TOKEN'].trim() !== '');
        const hasAppPassword = !!(config['GMAIL_APP_PASSWORD'] && config['GMAIL_APP_PASSWORD'].trim() !== '');

        if (gmailScriptUrl && gmailScriptUrl.trim() !== '') {
          if (!hasScriptToken && !hasAppPassword) {
            throw new Error(`[ENVIRONMENT_ERROR] "GMAIL_SCRIPT_TOKEN" or "GMAIL_APP_PASSWORD" is required when "GMAIL_SCRIPT_URL" is set!`);
          }
        } else if (!hasAppPassword) {
          throw new Error(`[ENVIRONMENT_ERROR] "GMAIL_APP_PASSWORD" is required for SMTP email delivery when "GMAIL_SCRIPT_URL" is not set!`);
        }

        return config;
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
      },
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, MonitoringModule],
      inject: [ConfigService, MonitoringService],
      useFactory: (config: ConfigService, monitoringService: MonitoringService) => {
        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV !== 'production',
          logger: new TypeOrmStructuredLogger(monitoringService),
          logging: ['query', 'error', 'schema', 'migration'],
          maxQueryExecutionTime: 500, // trigger logQuerySlow for queries > 500ms to capture slow database queries
          retryAttempts: 10,
          retryDelay: 3000,
          extra: {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          },
        };
      },
    }),
    AuthModule,
    UsersModule,
    DefectReportsModule,
    NotificationsModule,
    MasterDataModule,
    ComponentIssueModule,
    VendorFaultModule,
    SalaryDeductionModule,
    ImageUploadModule,
    AnalyticsModule,
    EmailModule,
    EmailMonitoringModule,
    MonitoringModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
