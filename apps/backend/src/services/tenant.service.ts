/**
 * 租户管理服务
 */

import { PrismaClient, TenantStatus, PlanType } from '@prisma/client';
import { createNotFoundError, createBadRequestError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export interface CreateTenantDto {
  name: string;
  slug: string;
  plan?: PlanType;
  settings?: Record<string, any>;
}

export interface UpdateTenantDto {
  name?: string;
  status?: TenantStatus;
  plan?: PlanType;
  settings?: Record<string, any>;
}

/**
 * 创建租户
 */
export const createTenant = async (data: CreateTenantDto) => {
  // 检查 slug 是否已存在
  const existing = await prisma.tenant.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw createBadRequestError('租户标识已存在');
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      plan: data.plan || PlanType.BASIC,
      settings: data.settings || {},
    },
  });

  return tenant;
};

/**
 * 获取租户列表
 */
export const getTenants = async (options?: {
  page?: number;
  limit?: number;
  status?: TenantStatus;
}) => {
  const { page = 1, limit = 20, status } = options || {};
  
  const where: any = {};
  if (status) {
    where.status = status;
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    data: tenants,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取租户详情
 */
export const getTenantById = async (id: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          knowledgeBases: true,
          conversations: true,
        },
      },
    },
  });

  if (!tenant) {
    throw createNotFoundError('租户不存在');
  }

  return tenant;
};

/**
 * 通过 slug 获取租户
 */
export const getTenantBySlug = async (slug: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    throw createNotFoundError('租户不存在');
  }

  return tenant;
};

/**
 * 更新租户
 */
export const updateTenant = async (id: string, data: UpdateTenantDto) => {
  // 检查租户是否存在
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    throw createNotFoundError('租户不存在');
  }

  // 如果更新 slug，检查是否冲突
  if (data.slug) {
    const conflict = await prisma.tenant.findFirst({
      where: { slug: data.slug, id: { not: id } },
    });
    if (conflict) {
      throw createBadRequestError('租户标识已存在');
    }
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data,
  });

  return tenant;
};

/**
 * 删除租户（软删除）
 */
export const deleteTenant = async (id: string) => {
  // 检查租户是否存在
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    throw createNotFoundError('租户不存在');
  }

  // 软删除：更新状态
  const tenant = await prisma.tenant.update({
    where: { id },
    data: { status: TenantStatus.DELETED },
  });

  return tenant;
};

/**
 * 暂停/恢复租户
 */
export const toggleTenantStatus = async (id: string) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    throw createNotFoundError('租户不存在');
  }

  const newStatus = tenant.status === TenantStatus.ACTIVE
    ? TenantStatus.SUSPENDED
    : TenantStatus.ACTIVE;

  return prisma.tenant.update({
    where: { id },
    data: { status: newStatus },
  });
};
