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

  // Health & Database Check Cache (dampens repeated queries on readiness/health checks)
  private lastDbHealthResult: { status: string; latencyMs: number; error?: string } | null = null;
  private lastDbHealthCheckTime = 0;
  private readonly DB_HEALTH_CACHE_TTL_MS = 15000; // 15 seconds cache when healthy
  private inFlightDbCheck: Promise<{ status: string; latencyMs: number; error?: string }> | null = null;

  private lastQueueMetrics: {
    status: 'available' | 'unavailable';
    emails: { pending: number; failed: number } | null;
    notifications: { pending: number; failed: number } | null;
  } | null = null;
  private lastQueueMetricsTime = 0;
  private inFlightQueueMetrics: Promise<{
    status: 'available' | 'unavailable';
    emails: { pending: number; failed: number } | null;
    notifications: { pending: number; failed: number } | null;
  }> | null = null;

  private lastDiskUsage: {
    totalGb: number;
    freeGb: number;
    usedGb: number;
    usagePercentage: number;
  } | undefined = undefined;
  private lastDiskCheckTime = 0;
  private readonly DISK_CACHE_TTL_MS = 60000;

  constructor(
    @Inject(forwardRef(() => DataSource)) private readonly dataSource: DataSource,
  ) {}

  clearHealthCache() {
    this.lastDbHealthResult = null;
    this.lastDbHealthCheckTime = 0;
    this.inFlightDbCheck = null;
    this.lastQueueMetrics = null;
    this.lastQueueMetricsTime = 0;
    this.inFlightQueueMetrics = null;
    this.lastDiskUsage = undefined;
    this.lastDiskCheckTime = 0;
  }

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
    if (!this.dbLatencies) {
      (this as any).dbLatencies = [];
    }
    this.dbLatencies.push(latencyMs);
    if (this.dbLatencies.length > 1000) this.dbLatencies.shift();
  }

  recordEmailLatency(latencyMs: number) {
    if (!this.emailLatencies) {
      (this as any).emailLatencies = [];
    }
    this.emailLatencies.push(latencyMs);
    if (this.emailLatencies.length > 1000) this.emailLatencies.shift();
  }

  recordNotificationLatency(latencyMs: number) {
    if (!this.notificationLatencies) {
      (this as any).notificationLatencies = [];
    }
    this.notificationLatencies.push(latencyMs);
    if (this.notificationLatencies.length > 1000) this.notificationLatencies.shift();
  }

  recordQueueProcessingTime(timeMs: number) {
    if (!this.queueProcessingTimes) {
      (this as any).queueProcessingTimes = [];
    }
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

  async checkDatabaseHealth(forceFresh = false): Promise<{ status: string; latencyMs: number; error?: string }> {
    const now = Date.now();
    if (!forceFresh && this.lastDbHealthResult && this.lastDbHealthResult.status === 'healthy') {
      if (now - this.lastDbHealthCheckTime < this.DB_HEALTH_CACHE_TTL_MS) {
        return this.lastDbHealthResult;
      }
    }

    if (!forceFresh && this.inFlightDbCheck) {
      return this.inFlightDbCheck;
    }

    const probe = (async () => {
      const start = Date.now();
      try {
        if (!this.dataSource || !this.dataSource.isInitialized) {
          throw new Error('Database connection is not initialized');
        }
        await this.dataSource.query('SELECT 1');
        const latencyMs = Date.now() - start;
        const result = { status: 'healthy', latencyMs };
        this.lastDbHealthResult = result;
        this.lastDbHealthCheckTime = Date.now();
        return result;
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        const isNotInitialized = err?.message === 'Database connection is not initialized';
        if (!isNotInitialized) {
          this.logger.warn(`Database readiness check failed: ${err?.message || 'Unknown error'}`);
        }
        const result = {
          status: 'unhealthy',
          latencyMs,
          error: isNotInitialized
            ? 'Database connection is not initialized'
            : 'Database connectivity check failed',
        };
        // When unhealthy, invalidate cache so subsequent check tests DB immediately
        this.lastDbHealthResult = null;
        this.lastDbHealthCheckTime = 0;
        return result;
      }
    })();

    if (!forceFresh) {
      this.inFlightDbCheck = probe;
    }

    try {
      return await probe;
    } finally {
      if (this.inFlightDbCheck === probe) {
        this.inFlightDbCheck = null;
      }
    }
  }

  private async getDiskUsageCached() {
    const now = Date.now();
    if (this.lastDiskUsage && now - this.lastDiskCheckTime < this.DISK_CACHE_TTL_MS) {
      return this.lastDiskUsage;
    }
    if (typeof fs.promises?.statfs === 'function') {
      try {
        const stats = await fs.promises.statfs(process.cwd());
        const totalBytes = Number(stats.bsize) * Number(stats.blocks);
        const freeBytes = Number(stats.bsize) * Number(stats.bfree);
        const usedBytes = totalBytes - freeBytes;
        this.lastDiskUsage = {
          totalGb: Number((totalBytes / (1024 ** 3)).toFixed(2)),
          freeGb: Number((freeBytes / (1024 ** 3)).toFixed(2)),
          usedGb: Number((usedBytes / (1024 ** 3)).toFixed(2)),
          usagePercentage: totalBytes > 0 ? Number((((totalBytes - freeBytes) / totalBytes) * 100).toFixed(2)) : 0,
        };
        this.lastDiskCheckTime = now;
        return this.lastDiskUsage;
      } catch {
        return this.lastDiskUsage;
      }
    }
    return undefined;
  }

  async getHealthMetrics(forceFresh = false) {
    const dbHealth = await this.checkDatabaseHealth(forceFresh);
    const memory = process.memoryUsage();
    const diskUsage = await this.getDiskUsageCached();

    let queueMetrics: {
      status: 'available' | 'unavailable';
      emails: { pending: number; failed: number } | null;
      notifications: { pending: number; failed: number } | null;
    };

    if (dbHealth.status !== 'healthy') {
      queueMetrics = {
        status: 'unavailable',
        emails: null,
        notifications: null,
      };
    } else if (
      !forceFresh &&
      this.lastQueueMetrics &&
      Date.now() - this.lastQueueMetricsTime < this.DB_HEALTH_CACHE_TTL_MS
    ) {
      queueMetrics = this.lastQueueMetrics;
    } else if (!forceFresh && this.inFlightQueueMetrics) {
      queueMetrics = await this.inFlightQueueMetrics;
    } else {
      const fetchQueueMetrics = (async () => {
        try {
          if (!this.dataSource || !this.dataSource.isInitialized) {
            return {
              status: 'unavailable' as const,
              emails: null,
              notifications: null,
            };
          }

          const emailRepo = this.dataSource.getRepository(EmailLog);
          const notificationRepo = this.dataSource.getRepository(Notification);
          const [pendingEmails, failedEmails, pendingNotifications, failedNotifications] = await Promise.all([
            emailRepo.count({ where: { status: EmailStatus.PENDING } }),
            emailRepo.count({ where: { status: EmailStatus.FAILED } }),
            notificationRepo.count({ where: { status: NotificationStatus.QUEUED } }),
            notificationRepo.count({ where: { status: NotificationStatus.FAILED } }),
          ]);

          const freshMetrics = {
            status: 'available' as const,
            emails: { pending: pendingEmails, failed: failedEmails },
            notifications: { pending: pendingNotifications, failed: failedNotifications },
          };
          this.lastQueueMetrics = freshMetrics;
          this.lastQueueMetricsTime = Date.now();
          return freshMetrics;
        } catch (err: any) {
          this.logger.error('Failed to query queue counts in health endpoint', err?.stack || err?.message);
          return {
            status: 'unavailable' as const,
            emails: null,
            notifications: null,
          };
        }
      })();

      if (!forceFresh) {
        this.inFlightQueueMetrics = fetchQueueMetrics;
      }

      try {
        queueMetrics = await fetchQueueMetrics;
      } finally {
        if (this.inFlightQueueMetrics === fetchQueueMetrics) {
          this.inFlightQueueMetrics = null;
        }
      }
    }

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      uptimeSeconds: uptime,
      timestamp: new Date().toISOString(),
      database: dbHealth,
      queues: queueMetrics,
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
