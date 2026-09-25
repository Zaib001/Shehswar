/**
 * SHEHSWAR ONE360 - Database Client Instance
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export * from '@prisma/client';
