import { Controller, Get, INestApplication, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as http from 'http';
import { DataSource } from 'typeorm';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EarlyBootExpressAdapter, attachEarlyBootMiddleware } from '../common/utils/early-boot-adapter';
import { EmailLog } from '../email/entities/email-log.entity';
import { Notification } from '../notifications/notification.entity';
import { HealthController } from './health.controller';
import { MonitoringService } from './monitoring.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Controller('throttled-test')
class ThrottledDummyController {
  @Get()
  getOk() {
    return { ok: true };
  }
}

function httpGet(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode || 0, body: data });
          }
        });
      })
      .on('error', reject);
  });
}

describe('Health & Performance Endpoints Lifecycle (HTTP + Guards + Early Boot)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let mockDataSource: { isInitialized: boolean; query: jest.Mock; getRepository: jest.Mock };
  let mockEmailRepo: { count: jest.Mock };
  let mockNotificationRepo: { count: jest.Mock };
  let monitoringService: MonitoringService;

  beforeAll(async () => {
    mockEmailRepo = { count: jest.fn().mockResolvedValue(0) };
    mockNotificationRepo = { count: jest.fn().mockResolvedValue(0) };
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === EmailLog) return mockEmailRepo;
        if (entity === Notification) return mockNotificationRepo;
        return { count: jest.fn().mockResolvedValue(0) };
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 3 }])],
      controllers: [HealthController, PerformanceController, ThrottledDummyController],
      providers: [
        MonitoringService,
        { provide: PerformanceService, useValue: { getHealthSummary: jest.fn().mockReturnValue({ ok: true }) } },
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          const roleHeader = req.headers['x-test-role'];
          if (!roleHeader) {
            throw new UnauthorizedException('Authentication required');
          }
          req.user = { id: 'u1', role: String(roleHeader) };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}/api`;
    monitoringService = moduleRef.get(MonitoringService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    monitoringService.clearHealthCache();
    mockDataSource.isInitialized = true;
    mockDataSource.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    mockEmailRepo.count.mockReset().mockResolvedValue(0);
    mockNotificationRepo.count.mockReset().mockResolvedValue(0);
  });

  it('should enforce JwtAuthGuard + ADMIN RolesGuard on PerformanceController while bypassing ThrottlerGuard', async () => {
    const guards = Reflect.getMetadata('__guards__', PerformanceController);
    const roles = new Reflector().get<Role[]>(ROLES_KEY, PerformanceController);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual([Role.ADMIN]);

    const unauth = await httpGet(`${baseUrl}/performance/health`);
    expect(unauth.status).toBe(401);

    const nonAdmin = await httpGet(`${baseUrl}/performance/health`, { 'x-test-role': 'INSPECTOR' });
    expect(nonAdmin.status).toBe(403);

    const adminResponses = await Promise.all(
      Array.from({ length: 6 }, () => httpGet(`${baseUrl}/performance/health`, { 'x-test-role': 'ADMIN' })),
    );
    expect(adminResponses.every((r) => r.status === 200)).toBe(true);
  });

  it('should bypass ThrottlerGuard on /api/health/live across 15 rapid requests while normal routes throttle at limit=3', async () => {
    const liveResponses = await Promise.all(Array.from({ length: 15 }, () => httpGet(`${baseUrl}/health/live`)));
    expect(liveResponses.every((r) => r.status === 200)).toBe(true);
    expect(mockDataSource.query).not.toHaveBeenCalled();

    const r1 = await httpGet(`${baseUrl}/throttled-test`);
    const r2 = await httpGet(`${baseUrl}/throttled-test`);
    const r3 = await httpGet(`${baseUrl}/throttled-test`);
    const r4 = await httpGet(`${baseUrl}/throttled-test`);
    expect([r1.status, r2.status, r3.status]).toEqual([200, 200, 200]);
    expect(r4.status).toBe(429);
  });

  it('should serve 200 OK on /api/health/live immediately during slow DB boot while failing closed (503) on other routes', async () => {
    let finishSlowInit!: () => void;
    const slowInitBarrier = new Promise<void>((r) => {
      finishSlowInit = r;
    });

    @Injectable()
    class SlowBootService implements OnModuleInit {
      async onModuleInit() {
        await slowInitBarrier;
      }
    }

    const adapter = new EarlyBootExpressAdapter();
    const expressInstance = adapter.getInstance();
    const bootGate = attachEarlyBootMiddleware(expressInstance);
    const earlyServer = http.createServer(expressInstance);
    adapter.setPreBoundServer(earlyServer);

    await new Promise<void>((resolve) => earlyServer.listen(0, '127.0.0.1', () => resolve()));
    const address = earlyServer.address() as any;
    const earlyBaseUrl = `http://127.0.0.1:${address.port}/api`;

    let earlyApp: INestApplication | undefined;
    try {
      const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          MonitoringService,
          SlowBootService,
          { provide: DataSource, useValue: mockDataSource },
          { provide: getRepositoryToken(EmailLog), useValue: mockEmailRepo },
          { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        ],
      }).compile();

      earlyApp = moduleRef.createNestApplication(adapter);
      earlyApp.setGlobalPrefix('api');

      // Start app.init() without awaiting yet — simulating slow TypeORM connect/migrations
      const initPromise = earlyApp.init();

      const liveDuringBoot = await httpGet(`${earlyBaseUrl}/health/live`);
      const readyDuringBoot = await httpGet(`${earlyBaseUrl}/health/ready`);
      expect(liveDuringBoot.status).toBe(200);
      expect(liveDuringBoot.body).toEqual(expect.objectContaining({ status: 'live', booting: true }));
      expect(readyDuringBoot.status).toBe(503);
      expect(readyDuringBoot.body).toEqual(expect.objectContaining({ status: 'starting' }));

      // Unblock boot and mark ready
      finishSlowInit();
      await initPromise;
      await earlyApp.listen(address.port);
      bootGate.markReady();

      const readyAfterBoot = await httpGet(`${earlyBaseUrl}/health/ready`);
      const liveAfterBoot = await httpGet(`${earlyBaseUrl}/health/live`);
      expect(readyAfterBoot.status).toBe(200);
      expect(readyAfterBoot.body.status).toBe('ready');
      expect(liveAfterBoot.status).toBe(200);
      expect(liveAfterBoot.body.booting).toBeUndefined();
    } finally {
      if (earlyApp) {
        await earlyApp.close();
      } else {
        await new Promise<void>((resolve) => earlyServer.close(() => resolve()));
      }
    }
  });

  it('should coalesce concurrent cold /api/health/ready requests to a single SELECT 1 query', async () => {
    let releaseQuery!: (value: any) => void;
    mockDataSource.query.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseQuery = resolve;
        }),
    );

    const pending = Promise.all(Array.from({ length: 5 }, () => httpGet(`${baseUrl}/health/ready`)));
    await new Promise((r) => setTimeout(r, 30));
    releaseQuery([{ '?column?': 1 }]);

    const responses = await pending;
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
  });

  it('should return HTTP 503 on /api/health when DB fails and skip queue count queries', async () => {
    mockDataSource.query.mockRejectedValueOnce(new Error('secret password or host info'));
    const res = await httpGet(`${baseUrl}/health`);

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.database.error).toBe('Database connectivity check failed');
    expect(res.body.queues).toEqual({
      status: 'unavailable',
      emails: null,
      notifications: null,
    });
    expect(mockEmailRepo.count).not.toHaveBeenCalled();
    expect(mockNotificationRepo.count).not.toHaveBeenCalled();
  });
});
