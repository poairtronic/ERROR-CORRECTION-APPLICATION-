import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MonitoringService } from './monitoring.service';

@Controller('health')
export class HealthController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  async getHealth() {
    return this.monitoringService.getHealthMetrics();
  }

  @Get('live')
  getLive(@Res() res: Response) {
    // Liveness check: simple heartbeat returning 200 OK
    return res.status(HttpStatus.OK).json({ status: 'live', uptime: process.uptime() });
  }

  @Get('ready')
  async getReady(@Res() res: Response) {
    // Readiness check: verify downstream database connectivity
    const dbHealth = await this.monitoringService.checkDatabaseHealth();
    if (dbHealth.status === 'healthy') {
      return res.status(HttpStatus.OK).json({ status: 'ready', database: dbHealth });
    } else {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'unready', database: dbHealth });
    }
  }
}
