/**
 * 全局错误处理中间件
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// 自定义错误类
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 错误
export const createBadRequestError = (message: string) => new AppError(message, 400);

// 401 错误
export const createUnauthorizedError = (message = '未授权访问') => new AppError(message, 401);

// 403 错误
export const createForbiddenError = (message = '禁止访问') => new AppError(message, 403);

// 404 错误
export const createNotFoundError = (message = '资源不存在') => new AppError(message, 404);

// 500 错误
export const createInternalServerError = (message = '服务器内部错误') => new AppError(message, 500);

// 全局错误处理
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 记录错误日志
  logger.error('错误发生', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // 处理 AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
  }

  // 处理 Prisma 错误
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: {
        message: '数据库操作失败',
        statusCode: 400,
      },
    });
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        message: '令牌无效',
        statusCode: 401,
      },
    });
  }

  // 默认 500 错误
  return res.status(500).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
      statusCode: 500,
    },
  });
};
