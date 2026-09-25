/**
 * SHEHSWAR ONE360 - Health & Liveness Probes
 */
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../core/decorators/public.decorator';
import { PrismaService } from '../../core/database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    let dbStatus = 'UP';
    try {
      // Light probe
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DOWN';
    }

    const isHealthy = dbStatus === 'UP';

    return {
      status: isHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  }
}
