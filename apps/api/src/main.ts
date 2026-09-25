/**
 * SHEHSWAR ONE360 - Backend API Entry Point
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { getConfig } from '@shehswar/config';
import { logger } from '@shehswar/logger';

async function bootstrap() {
  const config = getConfig();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // CORS
  app.enableCors({
    origin: config.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Organization-ID',
      'X-Company-ID',
    ],
  });

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SHEHSWAR ONE360 API')
    .setDescription('Enterprise ERP & CRM Core Architecture API')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'bearer-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.PORT);
  logger.info(`🚀 SHEHSWAR ONE360 API started successfully on port ${config.PORT}`);
  logger.info(
    `📖 Swagger API documentation available at: http://localhost:${config.PORT}/api/docs`,
  );
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during SHEHSWAR ONE360 API bootstrap');
  process.exit(1);
});
