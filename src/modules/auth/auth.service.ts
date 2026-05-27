import { createHash, randomBytes } from 'node:crypto';
import type {
  ChangePasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
} from '@bopacorp/shared/auth';
import { env } from '@config/env.js';
import {
  auditLogs,
  authTokens,
  loginLogs,
  permissions,
  rolePermissions,
  users,
} from '@db/schema/auth.js';
import { db } from '@lib/db.js';
import { createModuleLogger } from '@lib/logger.js';
import { HttpError, NotFoundError, UnauthorizedError } from '@shared/errors/http-error.js';
import bcrypt from 'bcrypt';
import { and, count, eq, gt, gte, inArray, isNull, lt } from 'drizzle-orm';
import jwt, { type SignOptions } from 'jsonwebtoken';

const logger = createModuleLogger('auth-service');

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

function parseTimeToSeconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const [, numStr, unit] = match;
  const num = Number(numStr);
  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 0;
  }
}

function getAccessExpiresInSeconds(): number {
  const seconds = parseTimeToSeconds(env.JWT_EXPIRES_IN);
  return seconds > 0 ? seconds : 15 * 60;
}

function getRefreshExpiresInSeconds(): number {
  const seconds = parseTimeToSeconds(env.JWT_REFRESH_EXPIRES_IN);
  return seconds > 0 ? seconds : 7 * 86400;
}

function calculateLockoutDuration(attempts: number): number {
  if (attempts >= 10) return 60 * 60;
  if (attempts >= 7) return 30 * 60;
  if (attempts >= 5) return 15 * 60;
  if (attempts >= 3) return 5 * 60;
  if (attempts >= 2) return 1 * 60;
  return 0;
}

async function createLoginLog(params: {
  userId: string;
  status: 'success' | 'failed' | 'locked';
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}) {
  await db.insert(loginLogs).values({
    userId: params.userId,
    status: params.status,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}

async function createAuditLog(params: {
  tableName: string;
  recordId: string;
  operation: 'I' | 'U' | 'D';
  userId: string;
  oldData?: Record<string, unknown> | undefined;
  newData?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  notes?: string | undefined;
}) {
  await db.insert(auditLogs).values({
    tableName: params.tableName,
    recordId: params.recordId,
    operation: params.operation,
    userId: params.userId,
    oldData: params.oldData ?? null,
    newData: params.newData ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    notes: params.notes ?? null,
  });
}

async function checkIpRateLimit(ipAddress: string | undefined) {
  if (!ipAddress) return;

  const windowStart = new Date(Date.now() - 15 * 60 * 1000);

  const result = await db
    .select({ count: count() })
    .from(loginLogs)
    .where(
      and(
        eq(loginLogs.ipAddress, ipAddress),
        eq(loginLogs.status, 'failed'),
        gte(loginLogs.createdAt, windowStart)
      )
    );

  const failedCount = result[0]?.count ?? 0;

  if (failedCount >= 10) {
    throw new HttpError(
      429,
      'Too many failed login attempts from this IP. Please try again later.',
      'RATE_LIMITED'
    );
  }
}

async function cleanupExpiredRefreshTokens(userId: string) {
  await db
    .delete(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, 'refresh'),
        lt(authTokens.expiresAt, new Date())
      )
    );
}

export const authService = {
  async login(data: LoginRequest & { ipAddress?: string; userAgent?: string }) {
    await checkIpRateLimit(data.ipAddress);

    const user = await db.query.users.findFirst({
      where: and(eq(users.email, data.email), isNull(users.deletedAt)),
      with: {
        profile: true,
        userRoles: {
          where: (ur, { eq }) => eq(ur.isActive, true),
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await createLoginLog({
        userId: user.id,
        status: 'locked',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
      throw new UnauthorizedError(
        'Account temporarily locked due to failed login attempts. Please try again later.'
      );
    }

    if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
      await db
        .update(users)
        .set({ lockedUntil: null, failedLoginAttempts: 0 })
        .where(eq(users.id, user.id));
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!passwordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const lockDuration = calculateLockoutDuration(newAttempts);

      if (lockDuration > 0) {
        await db
          .update(users)
          .set({
            failedLoginAttempts: newAttempts,
            lockedUntil: new Date(Date.now() + lockDuration * 1000),
          })
          .where(eq(users.id, user.id));
      } else {
        await db
          .update(users)
          .set({ failedLoginAttempts: newAttempts })
          .where(eq(users.id, user.id));
      }

      await createLoginLog({
        userId: user.id,
        status: 'failed',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });

      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      await createLoginLog({
        userId: user.id,
        status: 'failed',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
      throw new UnauthorizedError('Account is deactivated');
    }

    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    await createLoginLog({
      userId: user.id,
      status: 'success',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    await cleanupExpiredRefreshTokens(user.id);

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshTokenRaw = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshTokenRaw);
    const refreshExpiresAt = new Date(Date.now() + getRefreshExpiresInSeconds() * 1000);

    await db.insert(authTokens).values({
      userId: user.id,
      token: refreshTokenHash,
      type: 'refresh',
      expiresAt: refreshExpiresAt,
    });

    const roleIds = user.userRoles.map((ur) => ur.roleId);
    const permissionCodes = new Set<string>();

    if (roleIds.length > 0) {
      const rolePerms = await db
        .select({ code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(and(eq(rolePermissions.isGranted, true), inArray(rolePermissions.roleId, roleIds)));
      for (const rp of rolePerms) {
        if (rp.code) {
          permissionCodes.add(rp.code);
        }
      }
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.userRoles.map((ur) => ur.role.slug),
        permissions: Array.from(permissionCodes),
        profile: user.profile
          ? {
              id: user.profile.id,
              firstName: user.profile.firstName,
              secondName: user.profile.secondName,
              lastName: user.profile.lastName,
              secondLastName: user.profile.secondLastName,
              nationalId: user.profile.nationalId,
              phone: user.profile.phone,
              avatarUrl: user.profile.avatarUrl,
              employeeCode: user.profile.employeeCode,
              address: user.profile.address,
            }
          : null,
      },
      tokens: {
        accessToken,
        refreshToken: refreshTokenRaw,
        expiresIn: getAccessExpiresInSeconds(),
      },
    };
  },

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    const result = await db
      .delete(authTokens)
      .where(and(eq(authTokens.token, tokenHash), eq(authTokens.type, 'refresh')))
      .returning();

    if (!result[0]) {
      logger.warn('Logout attempted with invalid or already revoked refresh token');
    }
  },

  async refresh(data: RefreshTokenRequest & { ipAddress?: string; userAgent?: string }) {
    const tokenHash = hashToken(data.refreshToken);

    const tokenRecord = await db.query.authTokens.findFirst({
      where: and(
        eq(authTokens.token, tokenHash),
        eq(authTokens.type, 'refresh'),
        gt(authTokens.expiresAt, new Date())
      ),
      with: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = tokenRecord.user;

    if (!user || user.deletedAt || !user.isActive) {
      await db
        .delete(authTokens)
        .where(and(eq(authTokens.userId, tokenRecord.userId), eq(authTokens.type, 'refresh')));
      throw new UnauthorizedError('User account is inactive or deleted');
    }

    await db.delete(authTokens).where(eq(authTokens.id, tokenRecord.id));

    const accessToken = generateAccessToken(user.id, user.email);
    const newRefreshTokenRaw = generateOpaqueToken();
    const newRefreshTokenHash = hashToken(newRefreshTokenRaw);
    const refreshExpiresAt = new Date(Date.now() + getRefreshExpiresInSeconds() * 1000);

    await db.insert(authTokens).values({
      userId: user.id,
      token: newRefreshTokenHash,
      type: 'refresh',
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken,
      refreshToken: newRefreshTokenRaw,
      expiresIn: getAccessExpiresInSeconds(),
    };
  },

  async forgotPassword(email: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.email, email), isNull(users.deletedAt)),
    });

    if (!user?.isActive) {
      return;
    }

    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, user.id), eq(authTokens.type, 'password_reset')));

    const resetTokenRaw = generateOpaqueToken();
    const resetTokenHash = hashToken(resetTokenRaw);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(authTokens).values({
      userId: user.id,
      token: resetTokenHash,
      type: 'password_reset',
      expiresAt,
    });

    logger.info({ userId: user.id }, 'Password reset token generated');

    // In production, the raw token would be sent via email.
    // Do not return the token in the API response.
  },

  async resetPassword(data: ResetPasswordRequest) {
    const tokenHash = hashToken(data.token);

    const tokenRecord = await db.query.authTokens.findFirst({
      where: and(
        eq(authTokens.token, tokenHash),
        eq(authTokens.type, 'password_reset'),
        gt(authTokens.expiresAt, new Date())
      ),
      with: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const user = tokenRecord.user;
    if (!user?.isActive || user?.deletedAt) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, user.id), eq(authTokens.type, 'password_reset')));

    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, user.id), eq(authTokens.type, 'refresh')));

    await createAuditLog({
      tableName: 'users',
      recordId: user.id,
      operation: 'U',
      userId: user.id,
      newData: { passwordChanged: true },
      notes: 'Password reset via token',
    });
  },

  async changePassword(
    userId: string,
    data: ChangePasswordRequest & { ipAddress?: string; userAgent?: string }
  ) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const passwordValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    await db
      .delete(authTokens)
      .where(and(eq(authTokens.userId, user.id), eq(authTokens.type, 'refresh')));

    await createAuditLog({
      tableName: 'users',
      recordId: user.id,
      operation: 'U',
      userId: user.id,
      newData: { passwordChanged: true },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      notes: 'Password changed by user',
    });
  },
};
