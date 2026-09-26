/**
 * SHEHSWAR ONE360 - Database Client Instance
 *
 * Configured with RFC 9562 UUIDv7 support for high-performance sequential B-tree indexing.
 */
import { PrismaClient } from '@prisma/client';
import { uuidv7, isUuidv7 } from '@shehswar/shared';

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

export { uuidv7, isUuidv7 };
export * from '@prisma/client';
