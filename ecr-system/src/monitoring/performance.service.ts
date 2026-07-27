import { Injectable, Logger, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { monitorEventLoopDelay, performance } from 'perf_hooks';
import * as os from 'os';
import { GlobalTelemetry } from '../common/global-telemetry';

@Injectable()
export class PerformanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PerformanceService');
  private readonly startTime = Date.now();

  private memoryInterval: NodeJS.Timeout;
  private cpuInterval: NodeJS.Timeout;
  private elHistogram = monitorEventLoopDelay({ resolution: 10 });
  private lastELU = performance.eventLoopUtilization();

  private slowQueries: { query: string; duration: number; timestamp: string; success: boolean }[] = [];
  private totalQueriesCount = 0;
  private failedQueriesCount = 0;
  private totalQueryDuration = 0;
  private transactionDurations: number[] = [];
  private connectionWaitTimes: number[] = [];

  private activeRequests = 0;
  private maxConcurrentRequests = 0;
  private requestCountThisSecond = 0;
  private rpsHistory: number[] = [];
  private rpsInterval: NodeJS.Timeout;
  private peakRps = 0;
  private totalRequestsLogged = 0;

  private uploadCount = 0;
  private totalUploadDuration = 0;
  private totalCloudinaryTime = 0;
  private totalUploadSize = 0;
  private maxMemoryDeltaDuringUpload = 0;

  private connectedSockets = 0;
  private socketDisconnections = 0;
  private socketEventsCount = 0;
  private socketEventInterval: NodeJS.Timeout;
  private socketEventsPerSec = 0;
  private totalBroadcastTime = 0;
  private socketBroadcastCount = 0;
  private socketServer: any = null;

  private emailSendCount = 0;
  private totalEmailSendDuration = 0;
  private totalSmtpTime = 0;
  private emailFailures = 0;
  private emailRetries = 0;

  constructor(
    @Inject(forwardRef(() => DataSource)) private readonly dataSource: DataSource,
  ) {
    this.slowQueries = [];
    this.transactionDurations = [];
    this.connectionWaitTimes = [];
    this.rpsHistory = [];
  }

  onModuleInit() {
    this.elHistogram.enable();

    this.memoryInterval = setInterval(() => this.monitorMemory(), 30000);
    this.cpuInterval = setInterval(() => this.monitorCpuAndEventLoop(), 10000);

    this.rpsInterval = setInterval(() => {
      this.rpsHistory.push(this.requestCountThisSecond);
      if (this.requestCountThisSecond > this.peakRps) {
        this.peakRps = this.requestCountThisSecond;
      }
      this.requestCountThisSecond = 0;
      if (this.rpsHistory.length > 60) {
        this.rpsHistory.shift();
      }
    }, 1000);

    this.socketEventInterval = setInterval(() => {
      this.socketEventsPerSec = this.socketEventsCount;
      this.socketEventsCount = 0;
    }, 1000);
  }

  onModuleDestroy() {
    this.elHistogram.disable();
    if (this.memoryInterval) clearInterval(this.memoryInterval);
    if (this.cpuInterval) clearInterval(this.cpuInterval);
    if (this.rpsInterval) clearInterval(this.rpsInterval);
    if (this.socketEventInterval) clearInterval(this.socketEventInterval);
  }

  incrementActiveRequests() {
    this.activeRequests++;
    this.requestCountThisSecond++;
    this.totalRequestsLogged++;
    if (this.activeRequests > this.maxConcurrentRequests) {
      this.maxConcurrentRequests = this.activeRequests;
    }
  }

  decrementActiveRequests() {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
  }

  private monitorMemory() {
    const memory = process.memoryUsage();
    const heapUsedMb = memory.heapUsed / 1024 / 1024;
    const rssMb = memory.rss / 1024 / 1024;

    GlobalTelemetry.latestMemoryMb = Number(heapUsedMb.toFixed(2));

    this.logger.log({
      message: `System Memory Status: RSS ${rssMb.toFixed(2)}MB | Heap Used ${heapUsedMb.toFixed(2)}MB`,
      category: 'SYSTEM',
      rssMb: Number(rssMb.toFixed(2)),
      heapUsedMb: Number(heapUsedMb.toFixed(2)),
      heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
      externalMb: Number((memory.external / 1024 / 1024).toFixed(2)),
      arrayBuffersMb: Number((memory.arrayBuffers ? memory.arrayBuffers / 1024 / 1024 : 0).toFixed(2)),
    });

    if (rssMb > 500) {
      this.logger.error(`[CRITICAL_LIMIT] Memory critically high: RSS is ${rssMb.toFixed(2)}MB (> 500MB)`);
    } else if (rssMb > 400) {
      this.logger.error(`[CRITICAL_LIMIT] Memory warning: RSS is ${rssMb.toFixed(2)}MB (> 400MB)`);
    } else if (rssMb > 300) {
      this.logger.warn(`[PERFORMANCE_WARN] Memory warning: RSS is ${rssMb.toFixed(2)}MB (> 300MB)`);
    } else if (rssMb > 200) {
      this.logger.warn(`[PERFORMANCE_WARN] Memory warning: RSS is ${rssMb.toFixed(2)}MB (> 200MB)`);
    }
  }

  private monitorCpuAndEventLoop() {
    const meanDelayMs = this.elHistogram.mean / 1e6;
    const maxDelayMs = this.elHistogram.max / 1e6;

    const elu = performance.eventLoopUtilization(this.lastELU);
    this.lastELU = elu;
    const eluPercent = elu.utilization * 100;

    const absoluteCpuUsage = process.cpuUsage();
    const cpuSec = Number(((absoluteCpuUsage.user + absoluteCpuUsage.system) / 1000000).toFixed(2));
    GlobalTelemetry.latestCpuSec = cpuSec;

    if (meanDelayMs > 100) {
      this.logger.error(`[CRITICAL_LIMIT] Event loop delay critically blocked: Mean Delay is ${meanDelayMs.toFixed(2)}ms (> 100ms)`);
    } else if (meanDelayMs > 50) {
      this.logger.error(`[CRITICAL_LIMIT] Event loop delay high: Mean Delay is ${meanDelayMs.toFixed(2)}ms (> 50ms)`);
    } else if (meanDelayMs > 20) {
      this.logger.warn(`[PERFORMANCE_WARN] Event loop delay elevated: Mean Delay is ${meanDelayMs.toFixed(2)}ms (> 20ms)`);
    }

    if (eluPercent > 80) {
      this.logger.warn(`[PERFORMANCE_WARN] Event Loop Utilization high: ${eluPercent.toFixed(2)}%`);
    }

    this.elHistogram.reset();
  }

  recordDbQuery(query: string, parameters: any[], durationMs: number, success = true) {
    if (!this.slowQueries) {
      this.slowQueries = [];
    }
    this.totalQueriesCount = (this.totalQueriesCount || 0) + 1;
    this.totalQueryDuration = (this.totalQueryDuration || 0) + (durationMs || 0);
    if (!success) {
      this.failedQueriesCount = (this.failedQueriesCount || 0) + 1;
    }

    this.slowQueries.push({
      query: query || '',
      duration: durationMs || 0,
      timestamp: new Date().toISOString(),
      success,
    });
    this.slowQueries.sort((a, b) => b.duration - a.duration);
    if (this.slowQueries.length > 20) {
      this.slowQueries.pop();
    }
  }

  recordTransaction(durationMs: number) {
    if (!this.transactionDurations) {
      this.transactionDurations = [];
    }
    this.transactionDurations.push(durationMs || 0);
    if (this.transactionDurations.length > 100) {
      this.transactionDurations.shift();
    }
  }

  recordConnectionWait(waitTimeMs: number) {
    this.connectionWaitTimes.push(waitTimeMs);
    if (this.connectionWaitTimes.length > 100) {
      this.connectionWaitTimes.shift();
    }
  }

  recordUpload(durationMs: number, sizeBytes: number, cloudinaryTimeMs: number, memoryDeltaMb: number) {
    this.uploadCount++;
    this.totalUploadDuration += durationMs;
    this.totalCloudinaryTime += cloudinaryTimeMs;
    this.totalUploadSize += sizeBytes;
    if (memoryDeltaMb > this.maxMemoryDeltaDuringUpload) {
      this.maxMemoryDeltaDuringUpload = memoryDeltaMb;
    }
  }

  setSocketServer(server: any) {
    this.socketServer = server;
  }

  recordSocketConnect() {
    this.connectedSockets++;
  }

  recordSocketDisconnect() {
    if (this.connectedSockets > 0) {
      this.connectedSockets--;
    }
    this.socketDisconnections++;
  }

  recordSocketEvent() {
    this.socketEventsCount++;
  }

  recordSocketBroadcast(durationMs: number) {
    this.socketBroadcastCount++;
    this.totalBroadcastTime += durationMs;
  }

  recordEmailSend(durationMs: number, smtpTimeMs: number, success: boolean, retryCount: number) {
    this.emailSendCount++;
    this.totalEmailSendDuration += durationMs;
    this.totalSmtpTime += smtpTimeMs;
    if (!success) {
      this.emailFailures++;
    }
    if (retryCount > 0) {
      this.emailRetries += retryCount;
    }
  }

  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getHealthSummary() {
    const memory = process.memoryUsage();
    const heapUsedMb = memory.heapUsed / 1024 / 1024;
    const rssMb = memory.rss / 1024 / 1024;
    
    const meanDelayMs = this.elHistogram.mean / 1e6;
    
    let status = 'healthy';
    if (rssMb > 400 || meanDelayMs > 50) {
      status = 'critical';
    } else if (rssMb > 200 || meanDelayMs > 20) {
      status = 'warning';
    }

    return {
      status,
      uptimeSeconds: this.getUptime(),
      timestamp: new Date().toISOString(),
    };
  }

  getMemoryMetrics() {
    const memory = process.memoryUsage();
    return {
      rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      externalMb: Number((memory.external / 1024 / 1024).toFixed(2)),
      arrayBuffersMb: Number((memory.arrayBuffers ? memory.arrayBuffers / 1024 / 1024 : 0).toFixed(2)),
    };
  }

  getCpuMetrics() {
    const load = os.loadavg();
    const cpus = os.cpus();
    const activeHandles = (process as any)._getActiveHandles ? (process as any)._getActiveHandles().length : 0;
    const activeRequests = (process as any)._getActiveRequests ? (process as any)._getActiveRequests().length : 0;

    const meanDelayMs = this.elHistogram.mean / 1e6;
    const maxDelayMs = this.elHistogram.max / 1e6;
    const p50DelayMs = this.elHistogram.percentile(50) / 1e6;
    const p95DelayMs = this.elHistogram.percentile(95) / 1e6;
    const p99DelayMs = this.elHistogram.percentile(99) / 1e6;

    const elu = performance.eventLoopUtilization();

    return {
      loadAverage: load,
      cores: cpus.length,
      activeHandles,
      activeRequests,
      eventLoop: {
        utilizationPercent: Number((elu.utilization * 100).toFixed(2)),
        meanDelayMs: Number(meanDelayMs.toFixed(2)),
        maxDelayMs: Number(maxDelayMs.toFixed(2)),
        p50DelayMs: Number(p50DelayMs.toFixed(2)),
        p95DelayMs: Number(p95DelayMs.toFixed(2)),
        p99DelayMs: Number(p99DelayMs.toFixed(2)),
      },
    };
  }

  getDatabaseMetrics() {
    const avgDuration = this.totalQueriesCount > 0 ? (this.totalQueryDuration / this.totalQueriesCount) : 0;
    const avgTxDuration = this.transactionDurations.length > 0
      ? (this.transactionDurations.reduce((a, b) => a + b, 0) / this.transactionDurations.length)
      : 0;
    const avgWaitDuration = this.connectionWaitTimes.length > 0
      ? (this.connectionWaitTimes.reduce((a, b) => a + b, 0) / this.connectionWaitTimes.length)
      : 0;

    return {
      totalQueries: this.totalQueriesCount,
      failedQueries: this.failedQueriesCount,
      avgQueryDurationMs: Number(avgDuration.toFixed(2)),
      avgTransactionDurationMs: Number(avgTxDuration.toFixed(2)),
      avgConnectionWaitTimeMs: Number(avgWaitDuration.toFixed(2)),
      top20SlowestQueries: this.slowQueries,
    };
  }

  getRpsStats() {
    const avgRps = this.rpsHistory.length > 0
      ? (this.rpsHistory.reduce((a, b) => a + b, 0) / this.rpsHistory.length)
      : 0;

    return {
      currentRps: this.rpsHistory[this.rpsHistory.length - 1] || 0,
      peakRps: this.peakRps,
      avgRps: Number(avgRps.toFixed(2)),
      concurrentRequests: this.activeRequests,
      maxConcurrentRequests: this.maxConcurrentRequests,
      totalRequestsLogged: this.totalRequestsLogged,
    };
  }

  getSocketMetrics() {
    let roomCount = 0;
    if (this.socketServer && this.socketServer.sockets && this.socketServer.sockets.adapter) {
      roomCount = this.socketServer.sockets.adapter.rooms.size;
    }

    const avgBroadcast = this.socketBroadcastCount > 0
      ? (this.totalBroadcastTime / this.socketBroadcastCount)
      : 0;

    const estimatedMemoryPerSocketKb = 25;
    const estimatedTotalMemoryKb = this.connectedSockets * estimatedMemoryPerSocketKb;

    return {
      connectedClients: this.connectedSockets,
      disconnectedClientsCount: this.socketDisconnections,
      rooms: roomCount,
      eventsPerSec: this.socketEventsPerSec,
      avgBroadcastDurationMs: Number(avgBroadcast.toFixed(2)),
      estimatedMemoryPerSocketKb,
      estimatedTotalMemoryOverheadKb: estimatedTotalMemoryKb,
    };
  }

  getUploadMetrics() {
    const avgDuration = this.uploadCount > 0 ? (this.totalUploadDuration / this.uploadCount) : 0;
    const avgCloudinary = this.uploadCount > 0 ? (this.totalCloudinaryTime / this.uploadCount) : 0;
    const avgSize = this.uploadCount > 0 ? (this.totalUploadSize / this.uploadCount) : 0;

    return {
      totalUploads: this.uploadCount,
      avgUploadDurationMs: Number(avgDuration.toFixed(2)),
      avgCloudinaryResponseTimeMs: Number(avgCloudinary.toFixed(2)),
      avgUploadSizeBytes: Number(avgSize.toFixed(2)),
      maxMemoryDeltaDuringUploadMb: Number(this.maxMemoryDeltaDuringUpload.toFixed(2)),
    };
  }

  getEmailMetrics() {
    const avgDuration = this.emailSendCount > 0 ? (this.totalEmailSendDuration / this.emailSendCount) : 0;
    const avgSmtp = this.emailSendCount > 0 ? (this.totalSmtpTime / this.emailSendCount) : 0;

    return {
      totalEmailsSent: this.emailSendCount,
      failedEmails: this.emailFailures,
      retryCount: this.emailRetries,
      avgSendDurationMs: Number(avgDuration.toFixed(2)),
      avgSmtpResponseTimeMs: Number(avgSmtp.toFixed(2)),
    };
  }

  getSummary() {
    return {
      health: this.getHealthSummary(),
      memory: this.getMemoryMetrics(),
      cpu: this.getCpuMetrics(),
      database: this.getDatabaseMetrics(),
      rps: this.getRpsStats(),
      socket: this.getSocketMetrics(),
      upload: this.getUploadMetrics(),
      email: this.getEmailMetrics(),
    };
  }
}
