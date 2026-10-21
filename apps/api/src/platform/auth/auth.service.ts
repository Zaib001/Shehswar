/**
 * SHEHSWAR ONE360 - Authentication Service
 */
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getConfig } from '@shehswar/config';
import { PrismaService } from '../../core/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { TokenPair, JwtPayload } from '@shehswar/types';

@Injectable()
export class AuthService {
  private readonly config = getConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ tokens: TokenPair; user: Record<string, unknown> }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        company: true,
        organization: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      throw new ForbiddenException(
        `Account temporarily locked due to failed attempts. Please retry in ${waitMinutes} minutes.`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account has been deactivated. Contact an administrator.');
    }

    const rawPassword = dto.password;
    const cleanPassword = rawPassword.trim();

    let isPasswordValid = await bcrypt.compare(rawPassword, user.passwordHash);
    if (!isPasswordValid && cleanPassword !== rawPassword) {
      isPasswordValid = await bcrypt.compare(cleanPassword, user.passwordHash);
    }

    if (!isPasswordValid) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;

      // Lock account after 5 failed attempts for 15 minutes
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      throw new UnauthorizedException('Invalid email or password.');
    }

    // Reset failed login counter upon successful authentication
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate unique session ID upfront
    const sessionId = randomUUID();

    // Sign Refresh Token (long-lived: 7d)
    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId },
      {
        secret: this.config.JWT_REFRESH_SECRET,
        expiresIn: this.config.JWT_REFRESH_EXPIRATION,
      },
    );

    // Hash refresh token for DB persistence
    const tokenHash = await bcrypt.hash(refreshToken, 8);

    // Sanitize network metadata to prevent PostgreSQL character length truncation
    const safeIp = meta?.ipAddress
      ? (String(meta.ipAddress).split(',')[0] ?? '').trim().slice(0, 45)
      : undefined;
    const safeUserAgent = meta?.userAgent
      ? String(meta.userAgent).slice(0, 490)
      : undefined;

    // Create active session atomically with real unique tokenHash
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash,
        userAgent: safeUserAgent,
        ipAddress: safeIp,
        expiresAt: sessionExpiresAt,
      },
    });

    // Extract roles & permissions
    const roles: string[] = [];
    const permissionsSet = new Set<string>();

    for (const ur of user.userRoles) {
      roles.push(ur.role.code);
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.code);
      }
    }
    const permissions = Array.from(permissionsSet);

    // Sign Access Token (short-lived: 15m)
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      companyId: user.companyId,
      sessionId,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.JWT_ACCESS_SECRET,
      expiresIn: this.config.JWT_ACCESS_EXPIRATION,
    });

    return {
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 mins in seconds
        tokenType: 'Bearer',
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        organization: user.organization
          ? {
              id: user.organization.id,
              code: user.organization.code,
              name: user.organization.name,
            }
          : null,
        company: user.company
          ? {
              id: user.company.id,
              code: user.company.code,
              name: user.company.name,
              isParent: user.company.isParent,
            }
          : null,
        roles,
        permissions,
      },
    };
  }

  async logout(sessionId?: string): Promise<void> {
    if (!sessionId) return;
    await this.prisma.userSession.updateMany({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  /**
   * Refreshes access token with token rotation and reuse detection
   */
  async refreshToken(rawRefreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; sessionId: string };
    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: this.config.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const { sub: userId, sessionId } = payload;

    // Fetch user and session
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.userSession.findUnique({
        where: { id: sessionId },
      }),
    ]);

    if (!user || !user.isActive) {
      throw new ForbiddenException('User account has been deactivated.');
    }

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid, revoked, or expired.');
    }

    // Token Reuse Detection: verify stored bcrypt hash against incoming token
    const isTokenMatch = await bcrypt.compare(rawRefreshToken, session.tokenHash);
    if (!isTokenMatch) {
      // Security Incident: Old or stolen token presented after rotation!
      // Invalidate the session immediately to protect user.
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException(
        'Token reuse detected. Session has been revoked for security.',
      );
    }

    // Extract updated roles & permissions
    const roles: string[] = [];
    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      roles.push(ur.role.code);
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.code);
      }
    }
    const permissions = Array.from(permissionsSet);

    // Sign new access token
    const newAccessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      companyId: user.companyId,
      sessionId: session.id,
      roles,
      permissions,
    };

    const newAccessToken = this.jwtService.sign(newAccessPayload, {
      secret: this.config.JWT_ACCESS_SECRET,
      expiresIn: this.config.JWT_ACCESS_EXPIRATION,
    });

    // Token Rotation: issue a new refresh token
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, sessionId: session.id },
      {
        secret: this.config.JWT_REFRESH_SECRET,
        expiresIn: this.config.JWT_REFRESH_EXPIRATION,
      },
    );

    // Update session with new hashed token
    const newTokenHash = await bcrypt.hash(newRefreshToken, 8);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        tokenHash: newTokenHash,
        lastActiveAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  /**
   * Revokes all active sessions for a user (e.g. upon password reset or admin lock)
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  /**
   * Resolves complete authenticated user context including organizational scope,
   * active market assignments, responsible managers, and authorized dealers.
   */
  async getUserContext(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        company: true,
        employee: {
          include: {
            department: true,
            plant: true,
            branch: true,
          },
        },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        marketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            region: {
              include: {
                businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
              },
            },
            zone: {
              include: {
                areaManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                region: {
                  include: {
                    businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                  },
                },
              },
            },
            territory: {
              include: {
                zone: {
                  include: {
                    areaManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    region: {
                      include: {
                        businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles: string[] = [];
    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      roles.push(ur.role.code);
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.code);
      }
    }

    const authorizedTerritoryIdsSet = new Set<string>();
    let resolvedBM: { id: string; name: string; phone?: string | null } | null = null;
    let resolvedAM: { id: string; name: string; phone?: string | null } | null = null;

    for (const ma of user.marketAssignments) {
      if (ma.territoryId) {
        authorizedTerritoryIdsSet.add(ma.territoryId);
        if (ma.territory?.zone?.areaManager && !resolvedAM) {
          resolvedAM = {
            id: ma.territory.zone.areaManager.id,
            name: `${ma.territory.zone.areaManager.firstName} ${ma.territory.zone.areaManager.lastName}`.trim(),
            phone: ma.territory.zone.areaManager.phone,
          };
        }
        if (ma.territory?.zone?.region?.businessManager && !resolvedBM) {
          resolvedBM = {
            id: ma.territory.zone.region.businessManager.id,
            name: `${ma.territory.zone.region.businessManager.firstName} ${ma.territory.zone.region.businessManager.lastName}`.trim(),
            phone: ma.territory.zone.region.businessManager.phone,
          };
        }
      }
      if (ma.zoneId) {
        if (ma.zone?.areaManager && !resolvedAM) {
          resolvedAM = {
            id: ma.zone.areaManager.id,
            name: `${ma.zone.areaManager.firstName} ${ma.zone.areaManager.lastName}`.trim(),
            phone: ma.zone.areaManager.phone,
          };
        }
        if (ma.zone?.region?.businessManager && !resolvedBM) {
          resolvedBM = {
            id: ma.zone.region.businessManager.id,
            name: `${ma.zone.region.businessManager.firstName} ${ma.zone.region.businessManager.lastName}`.trim(),
            phone: ma.zone.region.businessManager.phone,
          };
        }
        const zoneTerritories = await this.prisma.territory.findMany({
          where: { zoneId: ma.zoneId, isActive: true },
          select: { id: true },
        });
        zoneTerritories.forEach((t) => authorizedTerritoryIdsSet.add(t.id));
      }
      if (ma.regionId) {
        if (ma.region?.businessManager && !resolvedBM) {
          resolvedBM = {
            id: ma.region.businessManager.id,
            name: `${ma.region.businessManager.firstName} ${ma.region.businessManager.lastName}`.trim(),
            phone: ma.region.businessManager.phone,
          };
        }
        const regionTerritories = await this.prisma.territory.findMany({
          where: { zone: { regionId: ma.regionId }, isActive: true },
          select: { id: true },
        });
        regionTerritories.forEach((t) => authorizedTerritoryIdsSet.add(t.id));
      }
    }

    let authorizedDealers: { id: string }[] = [];
    const isSuperOrAdmin = user.isSuperAdmin || roles.includes('ROLE_SUPER_ADMIN') || roles.includes('ROLE_COMPANY_ADMIN');
    if (isSuperOrAdmin) {
      authorizedDealers = await this.prisma.dealer.findMany({
        where: { companyId: user.companyId },
        select: { id: true },
      });
    } else {
      const terrIds = Array.from(authorizedTerritoryIdsSet);
      authorizedDealers = await this.prisma.dealer.findMany({
        where: {
          companyId: user.companyId,
          OR: [
            ...(terrIds.length > 0 ? [{ territoryId: { in: terrIds } }] : []),
            { assignedFieldOfficerId: user.id },
            { officerAssignments: { some: { userId: user.id } } },
          ],
        },
        select: { id: true },
      });
    }

    return {
      id: user.id,
      userId: user.id,
      employeeId: user.employeeId,
      employeeCode: user.employee?.employeeCode,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      organizationId: user.organizationId,
      companyId: user.companyId,
      organization: {
        id: user.organization.id,
        code: user.organization.code,
        name: user.organization.name,
      },
      company: {
        id: user.company.id,
        code: user.company.code,
        name: user.company.name,
        isParent: user.company.isParent,
      },
      department: user.employee?.department ? {
        id: user.employee.department.id,
        code: user.employee.department.code,
        name: user.employee.department.name,
      } : null,
      role: roles[0] || 'USER',
      roles,
      permissions: Array.from(permissionsSet),
      marketAssignments: user.marketAssignments.map((ma) => ({
        id: ma.id,
        roleScope: ma.roleScope,
        isPrimary: ma.isPrimary,
        companyId: ma.companyId,
        regionId: ma.regionId,
        regionName: ma.region?.name,
        zoneId: ma.zoneId,
        zoneName: ma.zone?.name,
        territoryId: ma.territoryId,
        territoryName: ma.territory?.name,
        effectiveFrom: ma.effectiveFrom,
        effectiveTo: ma.effectiveTo,
        status: ma.status,
      })),
      responsibleManagers: {
        businessManager: resolvedBM,
        areaManager: resolvedAM,
      },
      authorizedTerritoryIds: Array.from(authorizedTerritoryIdsSet),
      authorizedDealerIds: authorizedDealers.map((d) => d.id),
      context: {
        organizationId: user.organizationId,
        companyId: user.companyId,
        regionId: user.marketAssignments[0]?.regionId,
        zoneId: user.marketAssignments[0]?.zoneId,
        territoryId: user.marketAssignments[0]?.territoryId,
      },
    };
  }
}

