import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const { StructuredLogger } = await import('./common/structured-logger');
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, { logger });
  
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
  const { IdempotencyInterceptor } = await import('./common/interceptors/idempotency.interceptor');
  const { MonitoringService } = await import('./monitoring/monitoring.service');
  const monitoringService = app.get(MonitoringService);
  
  app.useGlobalInterceptors(
    new CorrelationInterceptor(),
    new MetricsInterceptor(monitoringService),
    new IdempotencyInterceptor(),
    new TimeoutInterceptor(),
  );

  // CORS - allow frontend origin (configured via FRONTEND_URL env, falls back to localhost)
  app.enableCors({
    origin: config.get('FRONTEND_URL') || 'http://localhost:5173',
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

  const port = config.get('PORT') ?? 3000;
  await app.listen(port);
  console.log(`ECR System API running on port ${port}`);
}
bootstrap();

