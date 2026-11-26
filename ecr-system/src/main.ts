import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import * as http from 'http';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EarlyBootExpressAdapter, attachEarlyBootMiddleware } from './common/utils/early-boot-adapter';

async function bootstrap() {
  const { StructuredLogger } = await import('./common/structured-logger');
  const logger = new StructuredLogger();

  // Bind HTTP liveness before TypeORM connects/migrates so /api/health/live never blocks on cold DB startup
  const adapter = new EarlyBootExpressAdapter();
  const expressInstance = adapter.getInstance();
  if (expressInstance && typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', 1);
  }
  // Normalize accidental double /api/api/ prefix from external integrators
  expressInstance.use((req: any, _res: any, next: any) => {
    if (typeof req.url === 'string' && req.url.startsWith('/api/api/')) {
      req.url = req.url.replace(/^\/api\/api\//, '/api/');
    }
    next();
  });
  const bootGate = attachEarlyBootMiddleware(expressInstance);
  const port = Number(process.env.PORT) || 3000;
  const earlyServer = http.createServer(expressInstance);
  adapter.setPreBoundServer(earlyServer);

  await new Promise<void>((resolve, reject) => {
    earlyServer.once('error', reject);
    earlyServer.listen(port, () => resolve());
  });
  logger.log(`Early liveness endpoint bound on port ${port}; initializing application modules...`);

  try {
    const app = await NestFactory.create(AppModule, adapter, { logger });

    // Enable graceful shutdown hooks (SIGTERM, SIGINT handling)
    app.enableShutdownHooks();

    const config = app.get(ConfigService);

    // Enable cookie parsing for HttpOnly JWT cookie auth
    app.use(cookieParser());

    // Security Headers — configure CSP to allow WebSocket connections and inline scripts
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", 'wss:', 'ws:'],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          },
        },
      }),
    );

    // Performance
    app.use(compression());

    // Global Error Handler to sanitize stack traces
    app.useGlobalFilters(new AllExceptionsFilter());

    // Global Interceptors for standard response and timeout protection
    const { TimeoutInterceptor } = await import('./common/interceptors/timeout.interceptor');
    const { CorrelationInterceptor } = await import('./common/interceptors/correlation.interceptor');
    const { MetricsInterceptor } = await import('./common/interceptors/metrics.interceptor');
    const { PerformanceInterceptor } = await import('./common/interceptors/performance.interceptor');
    const { IdempotencyInterceptor } = await import('./common/interceptors/idempotency.interceptor');
    const { MonitoringService } = await import('./monitoring/monitoring.service');
    const { PerformanceService } = await import('./monitoring/performance.service');
    const monitoringService = app.get(MonitoringService);
    const performanceService = app.get(PerformanceService);

    app.useGlobalInterceptors(
      new CorrelationInterceptor(),
      new MetricsInterceptor(monitoringService),
      new PerformanceInterceptor(performanceService),
      new IdempotencyInterceptor(),
      new TimeoutInterceptor(),
    );

    // CORS - allow frontend origin (configured via FRONTEND_URL env, falls back to localhost)
    app.enableCors({
      origin: (origin, callback) => {
        callback(null, true);
      },
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');

    const finalPort = config.get('PORT') ?? port;
    await app.listen(finalPort);
    bootGate.markReady();
    console.log(`Velan Quality Hub API running on port ${finalPort}`);
  } catch (err: any) {
    bootGate.markFailed(err?.message || 'Bootstrap failed');
    logger.error(`Application bootstrap failed: ${err?.message || err}`, err?.stack);
    await new Promise<void>((resolve) => earlyServer.close(() => resolve()));
    process.exit(1);
  }
}
bootstrap();
