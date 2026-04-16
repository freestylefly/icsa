/**
 * 租户管理控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as tenantService from '../services/tenant.service';
import { CreateTenantDto, UpdateTenantDto } from '../services/tenant.service';
import { AppError } from '../middleware/errorHandler';

/**
 * 创建租户
 * POST /api/tenants
 */
export const createTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateTenantDto = req.body;
    
    // 验证必填字段
    if (!body.name || !body.slug) {
      throw new AppError('租户名称和标识为必填项', 400);
    }

    const tenant = await tenantService.createTenant(body);
    
    res.status(201).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取租户列表
 * GET /api/tenants
 */
export const getTenants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as any || undefined;

    const result = await tenantService.getTenants({ page, limit, status });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取租户详情
 * GET /api/tenants/:id
 */
export const getTenantById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const tenant = await tenantService.getTenantById(id);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新租户
 * PUT /api/tenants/:id
 */
export const updateTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body: UpdateTenantDto = req.body;

    const tenant = await tenantService.updateTenant(id, body);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除租户
 * DELETE /api/tenants/:id
 */
export const deleteTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const tenant = await tenantService.deleteTenant(id);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 暂停/恢复租户
 * PATCH /api/tenants/:id/status
 */
export const toggleTenantStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const tenant = await tenantService.toggleTenantStatus(id);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
};
