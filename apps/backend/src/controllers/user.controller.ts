/**
 * 用户管理控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { AppError } from '../middleware/errorHandler';

/**
 * 创建用户
 * POST /api/users
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;

    // 验证必填字段
    if (!body.tenantId || !body.email || !body.password || !body.name) {
      throw new AppError('缺少必填字段', 400);
    }

    // 验证密码强度
    if (body.password.length < 6) {
      throw new AppError('密码长度至少 6 位', 400);
    }

    const user = await userService.createUser(body);

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户列表
 * GET /api/users
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string || req.user?.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as any || undefined;

    if (!tenantId) {
      throw new AppError('租户 ID 为必填项', 400);
    }

    const result = await userService.getUsers(tenantId, { page, limit, status });

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
 * 获取用户详情
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.query.tenantId as string || req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('租户 ID 为必填项', 400);
    }

    const user = await userService.getUserById(id, tenantId);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户
 * PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.query.tenantId as string || req.user?.tenantId;
    const body = req.body;

    if (!tenantId) {
      throw new AppError('租户 ID 为必填项', 400);
    }

    const user = await userService.updateUser(id, tenantId, body);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除用户
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.query.tenantId as string || req.user?.tenantId;

    if (!tenantId) {
      throw new AppError('租户 ID 为必填项', 400);
    }

    const user = await userService.deleteUser(id, tenantId);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 分配角色
 * POST /api/users/:id/roles
 */
export const assignRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!roleIds || !Array.isArray(roleIds)) {
      throw new AppError('角色 ID 列表为必填项', 400);
    }

    const user = await userService.assignRoles(id, roleIds);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
