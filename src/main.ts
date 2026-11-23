import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { setupSwagger } from './config/swagger.config';
import compression from 'compression';

const logger = new Logger('Bootstrap');

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection:', reason?.stack || reason);
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err.stack || err.message);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(json({ limit: '512kb' }));
  app.use(urlencoded({ extended: true, limit: '512kb' }));
  app.use(cookieParser());

  // Normalize legacy or versioned API routes (e.g. /api/v1/guides/... -> /guides/...)
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/v1/')) {
      req.url = req.url.replace('/api/v1', '');
    }
    next();
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://200.141.12.188:3001',
    'https://petnest-guide.vercel.app',
    ...(process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/$/, ''))
      : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow if in whitelist or if coming from any IP on port 3000/3001
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/\d+\.\d+\.\d+\.\d+:(3000|3001)$/.test(origin)
      ) {
        return callback(null, true);
      }

      // Permissive fallback for staging/custom domain setups
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    exposedHeaders: ['Set-Cookie', 'Authorization'],
  });

  // Setup Swagger Documentation outside production (or when explicitly enabled)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true'
  ) {
    setupSwagger(app);
  }

  await app.listen(process.env.PORT ?? 5000);
  logger.log(
    `PetNest Backend successfully listening on port ${process.env.PORT ?? 5000}`,
  );
}
bootstrap().catch((err) => {
  logger.error('Fatal error during bootstrap:', err?.stack || err);
  process.exit(1);
});
