import { Global, Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { HealthController } from './health.controller';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';

@Global()
@Module({
  providers: [MonitoringService, PerformanceService],
  controllers: [MonitoringController, HealthController, PerformanceController],
  exports: [MonitoringService, PerformanceService],
})
export class MonitoringModule {}
