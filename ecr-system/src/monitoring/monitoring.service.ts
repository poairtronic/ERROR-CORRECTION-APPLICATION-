import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs';
import { EmailLog } from '../email/entities/email-log.entity';
import { Notification } from '../notifications/notification.entity';
import { EmailStatus } from '../email/enums/email-status.enum';
import { NotificationStatus } from '../common/enums/report-status.enum';

@Injectable()
export class MonitoringService {
  private readonly startTime = Date.now();
  private readonly logger = new Logger(MonitoringService.name);

  // Core Request Counters
  private totalRequests = 0;
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private totalLatencyMs = 0;
  private maxLatencyMs = 0;

  // Latency Buffers (capped at 1000 entries)
  private readonly dbLatencies: number[] = [];
  private readonly emailLatencies: number[] = [];
  private readonly notificationLatencies: number[] = [];
  private readonly queueProcessingTimes: number[] = [];

  private socketCount = 0;
  private loginAttempts = 0;
  private loginFailures = 0;

  constructor(
    @Inject(forwardRef(() => DataSource)) private readonly dataSource: DataSource,
  ) {}

  recordRequest(statusCode: number, latencyMs: number) {
    this.totalRequests++;
    this.totalLatencyMs += latencyMs;
    if (latencyMs > this.maxLatencyMs) {
      this.maxLatencyMs = latencyMs;
    }

    if (statusCode >= 500) {
      this.status5xx++;
    } else if (statusCode >= 400) {
      this.status4xx++;
    } else {
      this.status2xx++;
    }
  }

  recordLoginAttempt(success: boolean) {
    this.loginAttempts++;
    if (!success) {
      this.loginFailures++;
    }
  }

  recordDbQuery(latencyMs: number) {
    this.dbLatencies.push(latencyMs);
    if (this.dbLatencies.length > 1000) this.dbLatencies.shift();
  }

  recordEmailLatency(latencyMs: number) {
    this.emailLatencies.push(latencyMs);
    if (this.emailLatencies.length > 1000) this.emailLatencies.shift();
  }

  recordNotificationLatency(latencyMs: number) {
    this.notificationLatencies.push(latencyMs);
    if (this.notificationLatencies.length > 1000) this.notificationLatencies.shift();
  }

  recordQueueProcessingTime(timeMs: number) {
    this.queueProcessingTimes.push(timeMs);
    if (this.queueProcessingTimes.length > 1000) this.queueProcessingTimes.shift();
  }

  setSocketCount(count: number) {
    this.socketCount = count;
  }

  getAverage(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  getMax(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    return Math.max(...arr);
  }

  async checkDatabaseHealth(): Promise<{ status: string; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.dataSource || !this.dataSource.isInitialized) {
        throw new Error('Database connection is not initialized');
      }
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return { status: 'healthy', latencyMs };
    } catch (err: any) {
      return { status: 'unhealthy', latencyMs: Date.now() - start, error: err.message };
    }
  }

  async getHealthMetrics() {
    const dbHealth = await this.checkDatabaseHealth();
    const memory = process.memoryUsage();
    
    let diskUsage: any = undefined;
    if (typeof fs.statfsSync === 'function') {
      try {
        const stats = fs.statfsSync(process.cwd());
        const totalBytes = stats.bsize * stats.blocks;
        const freeBytes = stats.bsize * stats.bfree;
        const usedBytes = totalBytes - freeBytes;
        diskUsage = {
          totalGb: Number((totalBytes / (1024 ** 3)).toFixed(2)),
          freeGb: Number((freeBytes / (1024 ** 3)).toFixed(2)),
          usedGb: Number((usedBytes / (1024 ** 3)).toFixed(2)),
          usagePercentage: Number((((totalBytes - freeBytes) / totalBytes) * 100).toFixed(2)),
        };
      } catch (err) {
        // Fallback for systems where statfsSync fails
      }
    }

    // Fetch queue sizes directly from TypeORM repositories to prevent circular module dependencies
    let pendingEmails = 0;
    let failedEmails = 0;
    let pendingNotifications = 0;
    let failedNotifications = 0;

    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        pendingEmails = await this.dataSource.getRepository(EmailLog).count({
          where: { status: EmailStatus.PENDING },
        });
        failedEmails = await this.dataSource.getRepository(EmailLog).count({
          where: { status: EmailStatus.FAILED },
        });
        pendingNotifications = await this.dataSource.getRepository(Notification).count({
          where: { status: NotificationStatus.QUEUED },
        });
        failedNotifications = await this.dataSource.getRepository(Notification).count({
          where: { status: NotificationStatus.FAILED },
        });
      }
    } catch (err: any) {
      this.logger.error('Failed to query queue counts in health endpoint', err.stack);
    }

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      uptimeSeconds: uptime,
      timestamp: new Date().toISOString(),
      database: dbHealth,
      queues: {
        emails: { pending: pendingEmails, failed: failedEmails },
        notifications: { pending: pendingNotifications, failed: failedNotifications },
      },
      websocket: {
        activeConnections: this.socketCount,
      },
      system: {
        memory: {
          rssMb: Number((memory.rss / (1024 * 1024)).toFixed(2)),
          heapTotalMb: Number((memory.heapTotal / (1024 * 1024)).toFixed(2)),
          heapUsedMb: Number((memory.heapUsed / (1024 * 1024)).toFixed(2)),
          usagePercentage: Number(((memory.heapUsed / memory.heapTotal) * 100).toFixed(2)),
        },
        disk: diskUsage,
      },
    };
  }

  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memory = process.memoryUsage();
    const cpus = os.cpus();
    const avgLoad = os.loadavg();

    const avgLatencyMs = this.totalRequests > 0 ? Math.round(this.totalLatencyMs / this.totalRequests) : 0;
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;

    // SRE alerts
    const alerts: string[] = [];
    if (memoryUsagePercent > 85) {
      alerts.push(`CRITICAL: High Heap Memory Utilization (${memoryUsagePercent.toFixed(1)}%)`);
    } else if (memoryUsagePercent > 70) {
      alerts.push(`WARNING: Elevated Heap Memory Utilization (${memoryUsagePercent.toFixed(1)}%)`);
    }

    if (avgLatencyMs > 2000) {
      alerts.push(`CRITICAL: Extremely High Average Latency (${avgLatencyMs}ms)`);
    } else if (avgLatencyMs > 1000) {
      alerts.push(`WARNING: Elevated Average Latency (${avgLatencyMs}ms)`);
    }

    const errorRate5xx = this.totalRequests > 0 ? (this.status5xx / this.totalRequests) * 100 : 0;
    if (errorRate5xx > 10) {
      alerts.push(`CRITICAL: High Server Error Rate (${errorRate5xx.toFixed(1)}%)`);
    } else if (errorRate5xx > 5) {
      alerts.push(`WARNING: Elevated Server Error Rate (${errorRate5xx.toFixed(1)}%)`);
    }

    if (this.loginFailures > 20) {
      alerts.push(`WARNING: High volume of failed login attempts (${this.loginFailures} failures)`);
    }

    return {
      system: {
        uptimeSeconds: uptime,
        memory: {
          rssBytes: memory.rss,
          heapTotalBytes: memory.heapTotal,
          heapUsedBytes: memory.heapUsed,
          externalBytes: memory.external,
          usagePercentage: Number(memoryUsagePercent.toFixed(2)),
        },
        cpu: {
          model: cpus[0]?.model || 'Unknown',
          coresCount: cpus.length,
          loadAverage: avgLoad,
        },
      },
      performance: {
        totalRequests: this.totalRequests,
        averageLatencyMs: avgLatencyMs,
        maxLatencyMs: this.maxLatencyMs,
        statusCodes: {
          '2xx': this.status2xx,
          '4xx': this.status4xx,
          '5xx': this.status5xx,
        },
        latencies: {
          database: {
            averageMs: this.getAverage(this.dbLatencies),
            maxMs: this.getMax(this.dbLatencies),
          },
          email: {
            averageMs: this.getAverage(this.emailLatencies),
            maxMs: this.getMax(this.emailLatencies),
          },
          notification: {
            averageMs: this.getAverage(this.notificationLatencies),
            maxMs: this.getMax(this.notificationLatencies),
          },
          queueProcessing: {
            averageMs: this.getAverage(this.queueProcessingTimes),
            maxMs: this.getMax(this.queueProcessingTimes),
          },
        },
      },
      business: {
        loginAttempts: this.loginAttempts,
        loginFailures: this.loginFailures,
      },
      alertsEvaluated: {
        healthy: alerts.length === 0,
        activeAlerts: alerts,
      },
    };
  }
}
