import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DefectReportsModule } from './defect-reports/defect-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MasterDataModule } from './master-data/master-data.module';

import { ComponentIssueModule } from './component-issue/component-issue.module';
import { VendorFaultModule } from './vendor-fault/vendor-fault.module';
import { SalaryDeductionModule } from './salary-deduction/salary-deduction.module';
import { ImageUploadModule } from './image-upload/image-upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production', // dev only; use migrations in prod
        ssl: { rejectUnauthorized: false },
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
  ],
})
export class AppModule {}
