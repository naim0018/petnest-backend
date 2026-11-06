import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { VisitorTracingMiddleware } from './common/middlewae/visitor-tracing.middleware';
import { GuidesModule } from './guides/guides.module';
import { MediaModule } from './media/media.module';
import { PetsModule } from './pets/pets.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

function validateEnv(config: Record<string, unknown>) {
  const requiredKeys = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of requiredKeys) {
    const val = config[key] ?? process.env[key];
    if (!val || typeof val !== 'string' || val.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    PrismaModule,
    UsersModule,
    PetsModule,
    MediaModule,
    GuidesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VisitorTracingMiddleware).forRoutes('*');
  }
}
