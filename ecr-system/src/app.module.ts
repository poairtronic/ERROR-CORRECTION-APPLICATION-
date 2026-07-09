import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DefectReportsModule } from './defect-reports/defect-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MasterDataModule } from './master-data/master-data.module';

import { ComponentIssueModule } from './component-issue/component-issue.module';
import { VendorFaultModule } from './vendor-fault/vendor-fault.module';
import { SalaryDeductionModule } from './salary-deduction/salary-deduction.module';
import { ImageUploadModule } from './image-upload/image-upload.module';
import { AnalyticsModule } from './analytics/analytics.module';

import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        synchronize: true, // true to auto-sync schema on Render during MVP phase
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
  ],
})
export class AppModule {}
