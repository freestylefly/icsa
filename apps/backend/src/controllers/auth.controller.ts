/**
 * 认证控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';

/**
 * 用户注册
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
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

    const result = await authService.register(body);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 用户登录
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // 验证必填字段
    if (!email || !password) {
      throw new AppError('请输入邮箱和密码', 400);
    }

    const result = await authService.login({ email, password });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('请先登录', 401);
    }

    const user = await authService.getCurrentUser(req.user.userId);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 修改密码
 * PUT /api/auth/password
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('请先登录', 401);
    }

    const { oldPassword, newPassword } = req.body;

    // 验证必填字段
    if (!oldPassword || !newPassword) {
      throw new AppError('请输入原密码和新密码', 400);
    }

    // 验证新密码强度
    if (newPassword.length < 6) {
      throw new AppError('新密码长度至少 6 位', 400);
    }

    await authService.changePassword(req.user.userId, oldPassword, newPassword);

    res.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 退出登录
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // JWT 无状态，客户端删除令牌即可
    // 这里可以记录登出日志或将令牌加入黑名单（使用 Redis）
    
    res.json({
      success: true,
      message: '已退出登录',
    });
  } catch (error) {
    next(error);
  }
};
