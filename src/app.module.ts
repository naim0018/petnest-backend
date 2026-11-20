import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { VisitorTracingMiddleware } from './common/middlewae/visitor-tracing.middleware';
import { GuidesModule } from './guides/guides.module';
import { MediaModule } from './media/media.module';
import { PetsModule } from './pets/pets.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

function resolveBackendPath(relPath: string): string {
  const direct = resolve(process.cwd(), relPath);
  if (existsSync(direct)) return direct;
  const inSubdir = resolve(process.cwd(), 'petnest-backend', relPath);
  if (existsSync(inSubdir)) return inSubdir;
  return resolve(__dirname, '..', relPath);
}

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
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: resolveBackendPath('src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req, res }: any) => ({ req, res }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), 'petnest-backend', '.env'),
        resolve(__dirname, '..', '..', '.env'),
        resolve(__dirname, '..', '.env'),
      ],
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
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VisitorTracingMiddleware).forRoutes('*');
  }
}
