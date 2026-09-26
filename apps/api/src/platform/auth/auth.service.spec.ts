/**
 * SHEHSWAR ONE360 - Authentication & Refresh Token Security Unit Tests
 */
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';

describe('AuthService Refresh Token Security', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userSession: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
    );
  });

  const validUser = {
    id: 'user-001',
    email: 'finance@shehswar.com',
    isActive: true,
    organizationId: 'org-shehswar',
    companyId: 'comp-parent',
    userRoles: [],
  };

  it('Token Rotation: should issue a new token pair and rotate hashed token in session', async () => {
    const rawRefreshToken = 'valid-refresh-token-v1';
    const hashedToken = await bcrypt.hash(rawRefreshToken, 8);

    mockJwtService.verify.mockReturnValue({
      sub: 'user-001',
      sessionId: 'sess-001',
    });

    mockPrisma.user.findUnique.mockResolvedValue(validUser);
    mockPrisma.userSession.findUnique.mockResolvedValue({
      id: 'sess-001',
      userId: 'user-001',
      tokenHash: hashedToken,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    mockPrisma.userSession.update.mockResolvedValue({});

    const result = await authService.refreshToken(rawRefreshToken);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(mockPrisma.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-001' },
        data: expect.objectContaining({
          tokenHash: expect.any(String),
          lastActiveAt: expect.any(Date),
        }),
      }),
    );
  });

  it('Token Reuse Detection: should reject and immediately revoke session if old/stolen token is presented', async () => {
    const alreadyRotatedToken = 'old-stolen-token-v0';
    // Session in DB has already rotated to v1
    const currentTokenHash = await bcrypt.hash('new-active-token-v1', 8);

    mockJwtService.verify.mockReturnValue({
      sub: 'user-001',
      sessionId: 'sess-001',
    });

    mockPrisma.user.findUnique.mockResolvedValue(validUser);
    mockPrisma.userSession.findUnique.mockResolvedValue({
      id: 'sess-001',
      userId: 'user-001',
      tokenHash: currentTokenHash, // Mismatch with alreadyRotatedToken!
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    mockPrisma.userSession.update.mockResolvedValue({});

    await expect(authService.refreshToken(alreadyRotatedToken)).rejects.toThrow(
      UnauthorizedException,
    );

    // Verify session was revoked for security
    expect(mockPrisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-001' },
      data: { isRevoked: true },
    });
  });

  it('Account Deactivation: prevents refresh when user account is deactivated', async () => {
    const rawRefreshToken = 'valid-token';
    mockJwtService.verify.mockReturnValue({ sub: 'user-001', sessionId: 'sess-001' });

    mockPrisma.user.findUnique.mockResolvedValue({
      ...validUser,
      isActive: false, // DEACTIVATED
    });

    mockPrisma.userSession.findUnique.mockResolvedValue({
      id: 'sess-001',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    await expect(authService.refreshToken(rawRefreshToken)).rejects.toThrow(ForbiddenException);
  });

  it('Session Revocation: rejects refresh if session was already revoked', async () => {
    const rawRefreshToken = 'valid-token';
    mockJwtService.verify.mockReturnValue({ sub: 'user-001', sessionId: 'sess-001' });

    mockPrisma.user.findUnique.mockResolvedValue(validUser);
    mockPrisma.userSession.findUnique.mockResolvedValue({
      id: 'sess-001',
      isRevoked: true, // ALREADY REVOKED
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    await expect(authService.refreshToken(rawRefreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('Revoke All Sessions: invalidates all user sessions on password reset or admin revoke', async () => {
    mockPrisma.userSession.updateMany.mockResolvedValue({ count: 3 });

    await authService.revokeAllUserSessions('user-001');

    expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-001', isRevoked: false },
      data: { isRevoked: true },
    });
  });
});
