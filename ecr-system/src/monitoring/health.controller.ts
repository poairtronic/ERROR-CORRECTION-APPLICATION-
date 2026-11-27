import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { MonitoringService } from './monitoring.service';

@SkipThrottle({ default: true, auth: true })
@Controller('health')
export class HealthController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  async getHealth(@Res() res: Response) {
    const metrics = await this.monitoringService.getHealthMetrics();
    const httpStatus = metrics.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(httpStatus).json(metrics);
  }

  @Get('live')
  getLive(@Res() res: Response) {
    // Liveness check: simple heartbeat returning 200 OK without any database query
    return res.status(HttpStatus.OK).json({
      status: 'live',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
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
