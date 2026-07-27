import { Controller, Get } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('health')
  getHealth() {
    return this.performanceService.getHealthSummary();
  }

  @Get('stats')
  getStats() {
    return {
      memory: this.performanceService.getMemoryMetrics(),
      cpu: this.performanceService.getCpuMetrics(),
      rps: this.performanceService.getRpsStats(),
    };
  }

  @Get('memory')
  getMemory() {
    return this.performanceService.getMemoryMetrics();
  }

  @Get('cpu')
  getCpu() {
    return this.performanceService.getCpuMetrics();
  }

  @Get('database')
  getDatabase() {
    return this.performanceService.getDatabaseMetrics();
  }

  @Get('socket')
  getSocket() {
    return this.performanceService.getSocketMetrics();
  }

  @Get('uploads')
  getUploads() {
    return this.performanceService.getUploadMetrics();
  }

  @Get('emails')
  getEmails() {
    return this.performanceService.getEmailMetrics();
  }

  @Get('summary')
  getSummary() {
    return this.performanceService.getSummary();
  }
}
