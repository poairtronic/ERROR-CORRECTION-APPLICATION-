import { Global, Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { HealthController } from './health.controller';

@Global()
@Module({
  providers: [MonitoringService],
  controllers: [MonitoringController, HealthController],
  exports: [MonitoringService],
})
export class MonitoringModule {}
