import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DefectReportsModule } from './defect-reports/defect-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MasterDataModule } from './master-data/master-data.module';
import { MonitoringModule } from './monitoring/monitoring.module';

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
      envFilePath: '.env',
      validate: (config: Record<string, any>) => {
        const required = ['DATABASE_URL', 'JWT_SECRET', 'EMAIL_FROM', 'GMAIL_APP_PASSWORD'];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`[ENVIRONMENT_ERROR] Mandatory configuration key "${key}" is missing in environment!`);
          }
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 20,
      },
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production', // disabled in production to protect data schema
      }),
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
