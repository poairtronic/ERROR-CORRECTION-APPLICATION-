import { Injectable } from '@nestjs/common';
import * as os from 'os';

@Injectable()
export class MonitoringService {
  private readonly startTime = Date.now();
  private totalRequests = 0;
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private totalLatencyMs = 0;
  private maxLatencyMs = 0;

  // Track login attempts
  private loginAttempts = 0;
  private loginFailures = 0;

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

  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memory = process.memoryUsage();
    const cpus = os.cpus();
    const avgLoad = os.loadavg();

    // Calculate latency metrics
    const avgLatencyMs = this.totalRequests > 0 ? Math.round(this.totalLatencyMs / this.totalRequests) : 0;

    // Evaluate SRE alerts
    const alerts: string[] = [];
    
    // Alert: High memory utilization
    const heapLimit = memory.heapTotal;
    const heapUsed = memory.heapUsed;
    const memoryUsagePercent = (heapUsed / heapLimit) * 100;
    if (memoryUsagePercent > 85) {
      alerts.push(`CRITICAL: High Heap Memory Utilization (${memoryUsagePercent.toFixed(1)}%)`);
    } else if (memoryUsagePercent > 70) {
      alerts.push(`WARNING: Elevated Heap Memory Utilization (${memoryUsagePercent.toFixed(1)}%)`);
    }

    // Alert: High API latency
    if (avgLatencyMs > 2000) {
      alerts.push(`CRITICAL: Extremely High Average Latency (${avgLatencyMs}ms)`);
    } else if (avgLatencyMs > 1000) {
      alerts.push(`WARNING: Elevated Average Latency (${avgLatencyMs}ms)`);
    }

    // Alert: High error rate (5xx)
    const errorRate5xx = this.totalRequests > 0 ? (this.status5xx / this.totalRequests) * 100 : 0;
    if (errorRate5xx > 10) {
      alerts.push(`CRITICAL: High Server Error Rate (${errorRate5xx.toFixed(1)}%)`);
    } else if (errorRate5xx > 5) {
      alerts.push(`WARNING: Elevated Server Error Rate (${errorRate5xx.toFixed(1)}%)`);
    }

    // Alert: Failed Logins Spike
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
