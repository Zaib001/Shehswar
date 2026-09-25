/**
 * SHEHSWAR ONE360 - Database Transaction Management Service
 *
 * Orchestrates multi-entity atomic transactions (e.g. Intercompany order,
 * stock movement + ledger entry, batch reservation + dispatch).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@shehswar/database';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes a series of operations in an ACID database transaction.
   * If any step fails, the entire transaction is rolled back automatically.
   */
  async runInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number; // default 5000ms
      timeout?: number; // default 10000ms
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        return fn(tx);
      },
      {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 10000,
        isolationLevel: options?.isolationLevel,
      },
    );
  }
}
