/**
 * SHEHSWAR ONE360 - Core Module
 */
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './logger/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { CorrelationMiddleware } from './logger/correlation.middleware';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { DataScopeGuard } from './guards/data-scope.guard';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DataScopeGuard,
    },
  ],
  exports: [DatabaseModule],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
