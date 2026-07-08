import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Enable cookie parsing for HttpOnly JWT cookie auth
  app.use(cookieParser());

  // Security Headers
  app.use(helmet());

  // Performance
  app.use(compression());

  // Global Error Handler to sanitize stack traces
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS is only needed for local development. Production is same-origin.
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.setGlobalPrefix('api');

  const port = config.get('PORT') ?? 3000;
  await app.listen(port);
  console.log(`ECR System API running on port ${port}`);
}
bootstrap();

