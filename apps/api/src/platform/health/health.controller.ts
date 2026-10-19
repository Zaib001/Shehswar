/**
 * SHEHSWAR ONE360 - Health & Readiness Probes
 *
 * /health/live: Process liveness (is process responsive?)
 * /health/ready: Operational readiness (can service fulfill business requests?)
 *
 * Security: No database URLs, passwords, or internal infrastructure secrets are ever leaked.
 */
import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../core/decorators/public.decorator';
import { PrismaService } from '../../core/database/prisma.service';

@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Root Health Probe
   */
  @Public()
  @Get()
  ping() {
    return {
      status: 'UP',
      service: 'shehswar-one360-api',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Liveness Probe: Returns HTTP 200 if the Node.js event loop and HTTP server are responsive.
   */
  @Public()
  @Get('live')
  live() {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  /**
   * Readiness Probe: Verifies mandatory dependencies (PostgreSQL database).
   * Returns HTTP 200 when ready to accept user traffic; returns HTTP 503 if mandatory database is unavailable.
   */
  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    let dbStatus = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DOWN';
    }

    const isHealthy = dbStatus === 'UP';

    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: isHealthy ? 'UP' : 'UNAVAILABLE',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  }
}
