/**
 * 认证服务 - 用户注册、登录、JWT
 */

import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createBadRequestError, createUnauthorizedError } from '../middleware/errorHandler';
import { JwtPayload } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 令牌有效期 7 天

export interface RegisterDto {
  tenantId: string;
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

/**
 * 用户注册
 */
export const register = async (data: RegisterDto) => {
  const { tenantId, email, password, name } = data;

  // 检查邮箱是否已存在
  const existingUser = await prisma.user.findFirst({
    where: { tenantId, email },
  });

  if (existingUser) {
    throw createBadRequestError('该邮箱已被注册');
  }

  // 密码加密
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 创建用户（默认分配普通用户角色）
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      tenantId,
      email,
      passwordHash,
      name,
      status: UserStatus.ACTIVE,
    },
  });

  // 生成 JWT 令牌
  const token = generateToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roles: ['user'], // 默认角色
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
    },
    token,
  };
};

/**
 * 用户登录
 */
export const login = async (data: LoginDto) => {
  const { email, password } = data;

  // 查找用户（需要知道租户 ID，这里简化为通过邮箱查找）
  // 生产环境应该要求提供租户标识
  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      tenant: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw createUnauthorizedError('邮箱或密码错误');
  }

  // 检查用户状态
  if (user.status !== UserStatus.ACTIVE) {
    throw createUnauthorizedError('账号已被禁用');
  }

  // 验证密码
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw createUnauthorizedError('邮箱或密码错误');
  }

  // 更新最后登录时间
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // 提取角色名称
  const roles = user.roles.map(ur => ur.role.name);

  // 生成 JWT 令牌
  const token = generateToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roles,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      avatar: user.avatar,
      roles,
    },
    token,
  };
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw createUnauthorizedError('用户不存在');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    tenantId: user.tenantId,
    tenant: user.tenant,
    roles: user.roles.map(ur => ur.role.name),
    permissions: user.roles.flatMap(ur => ur.role.permissions as string[]),
  };
};

/**
 * 修改密码
 */
export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createUnauthorizedError('用户不存在');
  }

  // 验证旧密码
  const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isValid) {
    throw createBadRequestError('原密码错误');
  }

  // 加密新密码
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true };
};

/**
 * 生成 JWT 令牌
 */
const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * 验证并解析 JWT 令牌
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw createUnauthorizedError('令牌无效或已过期');
  }
};
