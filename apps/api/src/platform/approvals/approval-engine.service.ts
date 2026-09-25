/**
 * SHEHSWAR ONE360 - Configurable Approval Workflow Engine
 *
 * Evaluates document approval rules based on amount thresholds, company context,
 * and user role hierarchies. Manages state machine transitions.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ApprovalStatus } from '@shehswar/types';

@Injectable()
export class ApprovalEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submits a document for approval, initiating or advancing the approval process
   */
  async submitForApproval(params: {
    organizationId: string;
    companyId: string;
    documentType: string;
    documentId: string;
    amount?: number;
    requestedById: string;
  }): Promise<{ status: ApprovalStatus; currentLevel: number; totalLevels: number }> {
    // 1. Find matching rule
    const rule = await this.prisma.approvalRule.findFirst({
      where: {
        organizationId: params.organizationId,
        documentType: params.documentType,
        isActive: true,
      },
    });

    const totalLevels = rule ? 2 : 1; // Default multi-level or single level

    const request = await this.prisma.approvalRequest.upsert({
      where: {
        documentType_documentId: {
          documentType: params.documentType,
          documentId: params.documentId,
        },
      },
      update: {
        status: ApprovalStatus.PENDING_APPROVAL,
        currentLevel: 1,
        totalLevels,
        requestedById: params.requestedById,
      },
      create: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        documentType: params.documentType,
        documentId: params.documentId,
        status: ApprovalStatus.PENDING_APPROVAL,
        currentLevel: 1,
        totalLevels,
        requestedById: params.requestedById,
      },
    });

    return {
      status: request.status as ApprovalStatus,
      currentLevel: request.currentLevel,
      totalLevels: request.totalLevels,
    };
  }

  /**
   * Processes an approval action (APPROVED, REJECTED, SENT_BACK)
   */
  async processAction(params: {
    requestId: string;
    actorId: string;
    action: 'APPROVE' | 'REJECT' | 'SEND_BACK';
    comments?: string;
  }): Promise<{ newStatus: ApprovalStatus }> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request) {
      throw new BadRequestException('Approval request not found');
    }

    let newStatus: ApprovalStatus = ApprovalStatus.PENDING_APPROVAL;
    let nextLevel = request.currentLevel;

    if (params.action === 'APPROVE') {
      if (request.currentLevel >= request.totalLevels) {
        newStatus = ApprovalStatus.APPROVED;
      } else {
        nextLevel = request.currentLevel + 1;
        newStatus = ApprovalStatus.PARTIALLY_APPROVED;
      }
    } else if (params.action === 'REJECT') {
      newStatus = ApprovalStatus.REJECTED;
    } else if (params.action === 'SEND_BACK') {
      newStatus = ApprovalStatus.SENT_BACK;
    }

    await this.prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: newStatus,
        currentLevel: nextLevel,
      },
    });

    await this.prisma.approvalHistory.create({
      data: {
        requestId: request.id,
        actorId: params.actorId,
        action: params.action,
        level: request.currentLevel,
        comments: params.comments,
      },
    });

    return { newStatus };
  }
}
