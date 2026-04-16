/**
 * 认证中间件 - JWT 验证
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createUnauthorizedError } from './errorHandler';

// JWT Payload 类型
export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

/**
 * 认证中间件 - 验证 JWT 令牌
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从 Header 获取令牌
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createUnauthorizedError('请提供认证令牌');
    }

    const token = authHeader.substring(7);

    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // 附加到请求对象
    req.user = decoded;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 授权中间件 - 检查权限
 * @param permissions 所需权限列表
 */
export const authorize = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createUnauthorizedError('请先登录');
      }

      // TODO: 从数据库加载用户权限并验证
      // 暂时跳过权限检查，仅验证登录状态
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 租户隔离中间件 - 确保只能访问当前租户数据
 */
export const tenantIsolation = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw createUnauthorizedError('请先登录');
    }

    const { tenantId } = req.params;
    
    // 如果 URL 包含租户 ID，验证是否匹配
    if (tenantId && tenantId !== req.user.tenantId) {
      throw createUnauthorizedError('无权访问该租户数据');
    }

    // 自动注入租户 ID 到查询参数
    req.query.tenantId = req.user.tenantId;
    
    next();
  } catch (error) {
    next(error);
  }
};
