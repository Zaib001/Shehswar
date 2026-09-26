/**
 * SHEHSWAR ONE360 - Authentication Service
 */
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

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

    // Create active session
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: 'pending', // updated below
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
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
      sessionId: session.id,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.JWT_ACCESS_SECRET,
      expiresIn: this.config.JWT_ACCESS_EXPIRATION,
    });

    // Sign Refresh Token (long-lived: 7d)
    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId: session.id },
      {
        secret: this.config.JWT_REFRESH_SECRET,
        expiresIn: this.config.JWT_REFRESH_EXPIRATION,
      },
    );

    // Update session with hashed refresh token
    const tokenHash = await bcrypt.hash(refreshToken, 8);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { tokenHash },
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
}
