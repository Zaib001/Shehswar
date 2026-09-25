/**
 * SHEHSWAR ONE360 - NestJS Prisma Service
 */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@shehswar/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✓ Successfully connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database', error);
      // In production we allow retry; in dev log cleanly
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PostgreSQL database connection closed');
  }
}
