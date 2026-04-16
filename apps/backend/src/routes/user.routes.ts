/**
 * 用户管理路由
 */

import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// 所有用户管理接口需要认证
router.use(authenticate);

// 创建用户 - 需要管理员权限
router.post('/', authorize('user:manage'), userController.createUser);

// 获取用户列表
router.get('/', authorize('user:manage'), userController.getUsers);

// 获取用户详情
router.get('/:id', authorize('user:manage'), userController.getUserById);

// 更新用户
router.put('/:id', authorize('user:manage'), userController.updateUser);

// 删除用户
router.delete('/:id', authorize('user:manage'), userController.deleteUser);

// 分配角色
router.post('/:id/roles', authorize('user:manage'), userController.assignRoles);

export { router as userRoutes };
