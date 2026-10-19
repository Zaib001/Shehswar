/**
 * SHEHSWAR ONE360 - Immutable Audit Logging Service
 *
 * Captures all critical state mutations, permission modifications,
 * financial overrides, and sensitive field views across all modules.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateAuditLogInput, AuditLogEntry } from '@shehswar/types';
import { RequestContext } from '@shehswar/shared';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an immutable audit log entry to the database
   */
  async record(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    try {
      // Compute changed field keys if both old and new state are provided
      let changedFields: string[] = [];
      if (input.previousState && input.newState) {
        const allKeys = Array.from(
          new Set([...Object.keys(input.previousState), ...Object.keys(input.newState)]),
        );
        changedFields = allKeys.filter(
          (key) =>
            JSON.stringify(input.previousState?.[key]) !== JSON.stringify(input.newState?.[key]),
        );
      }

      const log = await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          companyId: input.companyId,
          actorId: input.actorId,
          actorEmail: input.actorEmail,
          resource: input.resource.toString(),
          resourceId: input.resourceId,
          action: input.action.toString(),
          previousState: (input.previousState as any) ?? undefined,
          newState: (input.newState as any) ?? undefined,
          changedFields,
          correlationId: input.correlationId || RequestContext.getCorrelationId(),
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: (input.metadata as any) ?? undefined,
        },
      });

      return {
        id: log.id,
        organizationId: log.organizationId,
        companyId: log.companyId ?? undefined,
        actorId: log.actorId,
        actorEmail: log.actorEmail ?? undefined,
        resource: log.resource,
        resourceId: log.resourceId,
        action: log.action,
        previousState: log.previousState as Record<string, unknown> | null,
        newState: log.newState as Record<string, unknown> | null,
        changedFields: log.changedFields,
        correlationId: log.correlationId,
        ipAddress: log.ipAddress ?? undefined,
        userAgent: log.userAgent ?? undefined,
        metadata: log.metadata as Record<string, unknown> | undefined,
        createdAt: log.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to write audit log entry', error);
      throw error;
    }
  }

  /**
   * Queries immutable audit trail entries with multi-tenant filtering
   */
  async query(params: {
    organizationId?: string;
    companyId?: string;
    actorId?: string;
    resource?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AuditLogEntry[]; total: number }> {
    const where: any = {};
    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.companyId) where.companyId = params.companyId;
    if (params.actorId) where.actorId = params.actorId;
    if (params.resource) where.resource = params.resource;
    if (params.action) where.action = params.action;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        organizationId: log.organizationId,
        companyId: log.companyId ?? undefined,
        actorId: log.actorId,
        actorEmail: log.actorEmail ?? undefined,
        resource: log.resource,
        resourceId: log.resourceId,
        action: log.action,
        previousState: log.previousState as Record<string, unknown> | null,
        newState: log.newState as Record<string, unknown> | null,
        changedFields: log.changedFields,
        correlationId: log.correlationId,
        ipAddress: log.ipAddress ?? undefined,
        userAgent: log.userAgent ?? undefined,
        metadata: log.metadata as Record<string, unknown> | undefined,
        createdAt: log.createdAt,
      })),
      total,
    };
  }

  async getById(id: string): Promise<AuditLogEntry | null> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
    });
    if (!log) return null;
    return {
      id: log.id,
      organizationId: log.organizationId,
      companyId: log.companyId ?? undefined,
      actorId: log.actorId,
      actorEmail: log.actorEmail ?? undefined,
      resource: log.resource,
      resourceId: log.resourceId,
      action: log.action,
      previousState: log.previousState as Record<string, unknown> | null,
      newState: log.newState as Record<string, unknown> | null,
      changedFields: log.changedFields,
      correlationId: log.correlationId,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
      metadata: log.metadata as Record<string, unknown> | undefined,
      createdAt: log.createdAt,
    };
  }
}

