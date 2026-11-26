import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { MonitoringService } from './monitoring.service';
import { EmailLog } from '../email/entities/email-log.entity';
import { Notification } from '../notifications/notification.entity';
import { EmailStatus } from '../email/enums/email-status.enum';
import { NotificationStatus } from '../common/enums/report-status.enum';

describe('MonitoringService', () => {
  let service: MonitoringService;

  const mockDataSource = {
    isInitialized: true,
    query: jest.fn(),
    getRepository: jest.fn(),
  };

  const mockEmailRepo = { count: jest.fn() };
  const mockNotificationRepo = { count: jest.fn() };

  beforeEach(async () => {
    mockDataSource.getRepository.mockImplementation((entity) => {
      if (entity === EmailLog) return mockEmailRepo;
      if (entity === Notification) return mockNotificationRepo;
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('recordRequest should update counters correctly', () => {
    service.recordRequest(200, 100);
    service.recordRequest(404, 200);
    service.recordRequest(500, 50);

    const metrics = service.getMetrics();
    expect(metrics.performance.totalRequests).toBe(3);
    expect(metrics.performance.statusCodes['2xx']).toBe(1);
    expect(metrics.performance.statusCodes['4xx']).toBe(1);
    expect(metrics.performance.statusCodes['5xx']).toBe(1);
    expect(metrics.performance.maxLatencyMs).toBe(200);
    expect(metrics.performance.averageLatencyMs).toBe(Math.round(350 / 3));
  });

  it('recordLoginAttempt should update counters', () => {
    service.recordLoginAttempt(true);
    service.recordLoginAttempt(false);
    service.recordLoginAttempt(false);

    const metrics = service.getMetrics();
    expect(metrics.business.loginAttempts).toBe(3);
    expect(metrics.business.loginFailures).toBe(2);
  });

  it('recordDbQuery should keep rolling list', () => {
    for (let i = 0; i < 1005; i++) {
      service.recordDbQuery(10);
    }
    const metrics = service.getMetrics();
    expect(metrics.performance.latencies.database.averageMs).toBe(10);
    // Buffer should be capped at 1000 items
  });

  it('checkDatabaseHealth should return healthy if query succeeds', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    const health = await service.checkDatabaseHealth();
    expect(health.status).toBe('healthy');
  });

  it('checkDatabaseHealth should cache healthy results within TTL to prevent database hammering', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const health1 = await service.checkDatabaseHealth();
    expect(health1.status).toBe('healthy');
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);

    // Second call within 15s should return cached healthy status without querying DB
    const health2 = await service.checkDatabaseHealth();
    expect(health2.status).toBe('healthy');
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);

    // Call with forceFresh = true should bypass cache and execute query
    const health3 = await service.checkDatabaseHealth(true);
    expect(health3.status).toBe('healthy');
    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
  });

  it('checkDatabaseHealth should not cache errors and immediately re-test database upon failure', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockRejectedValueOnce(new Error('Connection dropped'));

    const health1 = await service.checkDatabaseHealth();
    expect(health1.status).toBe('unhealthy');
    expect(health1.error).toBe('Database connectivity check failed');
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);

    // Subsequent call should immediately test DB without using a stale error cache
    mockDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
    const health2 = await service.checkDatabaseHealth();
    expect(health2.status).toBe('healthy');
    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
  });

  it('checkDatabaseHealth should return unhealthy if query fails', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockRejectedValue(new Error('Connection failed'));
    const health = await service.checkDatabaseHealth();
    expect(health.status).toBe('unhealthy');
    expect(health.error).toBe('Database connectivity check failed');
  });

  it('checkDatabaseHealth should share a single SELECT 1 query across concurrent cold requests', async () => {
    service.clearHealthCache();
    let resolveQuery!: (val: any) => void;
    mockDataSource.query.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveQuery = resolve;
      }),
    );

    const p1 = service.checkDatabaseHealth();
    const p2 = service.checkDatabaseHealth();
    const p3 = service.checkDatabaseHealth();

    resolveQuery([{ '?column?': 1 }]);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1.status).toBe('healthy');
    expect(r2.status).toBe('healthy');
    expect(r3.status).toBe('healthy');
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
  });

  it('checkDatabaseHealth should return unhealthy if uninitialized', async () => {
    service.clearHealthCache();
    mockDataSource.isInitialized = false;
    const health = await service.checkDatabaseHealth();
    expect(health.status).toBe('unhealthy');
    expect(health.error).toBe('Database connection is not initialized');
    mockDataSource.isInitialized = true; // reset
  });

  it('getHealthMetrics should retrieve data and queue sizes', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockResolvedValue([]);
    mockEmailRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    mockNotificationRepo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(1);

    const health = await service.getHealthMetrics();
    
    expect(health.status).toBe('healthy');
    expect(health.queues.emails?.pending).toBe(5);
    expect(health.queues.emails?.failed).toBe(2);
    expect(health.queues.notifications?.pending).toBe(10);
    expect(health.queues.notifications?.failed).toBe(1);
  });

  it('getHealthMetrics should cache queue metrics across rapid requests', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockResolvedValue([]);
    mockEmailRepo.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mockNotificationRepo.count.mockResolvedValueOnce(7).mockResolvedValueOnce(0);

    const health1 = await service.getHealthMetrics();
    expect(health1.queues.emails?.pending).toBe(3);
    expect(mockEmailRepo.count).toHaveBeenCalledTimes(2);

    // Second call within 15s should reuse cached queue metrics without calling repos again
    const health2 = await service.getHealthMetrics();
    expect(health2.queues.emails?.pending).toBe(3);
    expect(mockEmailRepo.count).toHaveBeenCalledTimes(2);
  });

  it('getMetrics should generate alerts for high latency or errors', () => {
    service.recordRequest(500, 3000);
    service.recordRequest(500, 3000);
    
    const metrics = service.getMetrics();
    expect(metrics.alertsEvaluated.healthy).toBe(false);
    expect(metrics.alertsEvaluated.activeAlerts.some(a => a.includes('CRITICAL: Extremely High Average Latency'))).toBe(true);
    expect(metrics.alertsEvaluated.activeAlerts.some(a => a.includes('CRITICAL: High Server Error Rate'))).toBe(true);
  });

  it('setSocketCount should update socket connections metric', async () => {
    service.setSocketCount(42);
    
    // We mock query to resolve quickly
    mockDataSource.query.mockResolvedValue([]);
    const health = await service.getHealthMetrics();
    expect(health.websocket.activeConnections).toBe(42);
  });

  it('recordEmailLatency and recordNotificationLatency should track metrics', () => {
    service.recordEmailLatency(150);
    service.recordNotificationLatency(80);
    service.recordQueueProcessingTime(500);

    const metrics = service.getMetrics();
    expect(metrics.performance.latencies.email.averageMs).toBe(150);
    expect(metrics.performance.latencies.notification.averageMs).toBe(80);
    expect(metrics.performance.latencies.queueProcessing.averageMs).toBe(500);
  });

  it('should handle uninitialized latency arrays gracefully', () => {
    (service as any).dbLatencies = undefined;
    (service as any).emailLatencies = undefined;
    (service as any).notificationLatencies = undefined;
    (service as any).queueProcessingTimes = undefined;

    service.recordDbQuery(10);
    service.recordEmailLatency(10);
    service.recordNotificationLatency(10);
    service.recordQueueProcessingTime(10);

    const metrics = service.getMetrics();
    expect(metrics.performance.latencies.database.averageMs).toBe(10);
  });

  it('getHealthMetrics should handle queue count error gracefully without caching fallback zeroes', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockResolvedValue([]);
    mockEmailRepo.count.mockRejectedValueOnce(new Error('db error'));

    const health1 = await service.getHealthMetrics();

    expect(health1.queues).toEqual({
      status: 'unavailable',
      emails: null,
      notifications: null,
    });

    // Next call must NOT read stale unavailable/zero cache
    mockEmailRepo.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    mockNotificationRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const health2 = await service.getHealthMetrics();
    expect(health2.queues).toEqual({
      status: 'available',
      emails: { pending: 4, failed: 1 },
      notifications: { pending: 2, failed: 0 },
    });
  });

  it('getHealthMetrics should skip queue count queries when DB health check fails', async () => {
    service.clearHealthCache();
    mockDataSource.query.mockRejectedValueOnce(new Error('Neon suspended or down'));

    const health = await service.getHealthMetrics();

    expect(health.status).toBe('unhealthy');
    expect(health.queues).toEqual({
      status: 'unavailable',
      emails: null,
      notifications: null,
    });
    expect(mockEmailRepo.count).not.toHaveBeenCalled();
    expect(mockNotificationRepo.count).not.toHaveBeenCalled();
  });

  it('getHealthMetrics should refresh DB cache after TTL expiry', async () => {
    service.clearHealthCache();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(100000);
    mockDataSource.query.mockResolvedValue([]);
    mockEmailRepo.count.mockResolvedValue(0);
    mockNotificationRepo.count.mockResolvedValue(0);

    await service.getHealthMetrics();
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(120000); // > 15s TTL
    await service.getHealthMetrics();
    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('getMetrics should generate warning alerts', () => {
    const memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapTotal: 100,
      heapUsed: 75,
      rss: 0,
      external: 0,
      arrayBuffers: 0
    } as any);

    service.recordRequest(200, 1500); // 1500 > 1000 => WARNING
    service.recordRequest(500, 100);  // 1 error out of 2 = 50% > 10% => CRITICAL (covers >10)
    // to get error rate >5 and <=10, we need 1 error in 15 requests
    for (let i = 0; i < 14; i++) service.recordRequest(200, 10);
    
    for (let i = 0; i < 21; i++) service.recordLoginAttempt(false); // >20 failures => WARNING

    const metrics = service.getMetrics();
    expect(metrics.alertsEvaluated.activeAlerts.some(a => a.includes('WARNING: Elevated Heap Memory Utilization'))).toBe(true);
    expect(metrics.alertsEvaluated.activeAlerts.some(a => a.includes('WARNING: High volume of failed login attempts'))).toBe(true);
    expect(metrics.alertsEvaluated.activeAlerts.some(a => a.includes('WARNING: Elevated Server Error Rate'))).toBe(true);

    memoryUsageSpy.mockRestore();
  });
});
