/**
 * 用户管理服务
 */

import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createNotFoundError, createBadRequestError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export interface CreateUserDto {
  tenantId: string;
  email: string;
  password: string;
  name: string;
  avatar?: string;
  roleIds?: string[];
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  avatar?: string;
  status?: UserStatus;
}

/**
 * 创建用户
 */
export const createUser = async (data: CreateUserDto) => {
  const { tenantId, email, password, name, avatar, roleIds } = data;

  // 检查邮箱是否已存在
  const existing = await prisma.user.findFirst({
    where: { tenantId, email },
  });

  if (existing) {
    throw createBadRequestError('该邮箱已被使用');
  }

  // 密码加密
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 创建用户并分配角色
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      avatar,
      tenantId,
      status: UserStatus.ACTIVE,
      roles: roleIds ? {
        create: roleIds.map(roleId => ({ roleId })),
      } : undefined,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  return user;
};

/**
 * 获取用户列表
 */
export const getUsers = async (tenantId: string, options?: {
  page?: number;
  limit?: number;
  status?: UserStatus;
}) => {
  const { page = 1, limit = 20, status } = options || {};
  
  const where: any = { tenantId };
  if (status) {
    where.status = status;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取用户详情
 */
export const getUserById = async (id: string, tenantId: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user || user.tenantId !== tenantId) {
    throw createNotFoundError('用户不存在');
  }

  return user;
};

/**
 * 更新用户
 */
export const updateUser = async (id: string, tenantId: string, data: UpdateUserDto) => {
  const user = await prisma.user.findUnique({ where: { id } });
  
  if (!user || user.tenantId !== tenantId) {
    throw createNotFoundError('用户不存在');
  }

  // 如果更新邮箱，检查是否冲突
  if (data.email) {
    const conflict = await prisma.user.findFirst({
      where: { tenantId, email: data.email, id: { not: id } },
    });
    if (conflict) {
      throw createBadRequestError('该邮箱已被使用');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data,
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  return updatedUser;
};

/**
 * 删除用户（软删除）
 */
export const deleteUser = async (id: string, tenantId: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  
  if (!user || user.tenantId !== tenantId) {
    throw createNotFoundError('用户不存在');
  }

  return prisma.user.update({
    where: { id },
    data: { status: UserStatus.DELETED },
  });
};

/**
 * 分配角色给用户
 */
export const assignRoles = async (userId: string, roleIds: string[]) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) {
    throw createNotFoundError('用户不存在');
  }

  // 删除现有角色
  await prisma.userRole.deleteMany({
    where: { userId },
  });

  // 分配新角色
  if (roleIds.length > 0) {
    await prisma.userRole.createMany({
      data: roleIds.map(roleId => ({ userId, roleId })),
    });
  }

  return getUserById(userId, user.tenantId);
};
