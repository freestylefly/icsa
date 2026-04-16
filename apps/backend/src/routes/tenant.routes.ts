/**
 * 租户管理路由
 */

import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// 所有租户管理接口需要认证
router.use(authenticate);

// 创建租户 - 需要管理员权限
router.post('/', authorize('tenant:manage'), tenantController.createTenant);

// 获取租户列表 - 需要管理员权限
router.get('/', authorize('tenant:manage'), tenantController.getTenants);

// 获取租户详情
router.get('/:id', tenantController.getTenantById);

// 更新租户 - 需要管理员权限
router.put('/:id', authorize('tenant:manage'), tenantController.updateTenant);

// 删除租户 - 需要管理员权限
router.delete('/:id', authorize('tenant:manage'), tenantController.deleteTenant);

// 暂停/恢复租户 - 需要管理员权限
router.patch('/:id/status', authorize('tenant:manage'), tenantController.toggleTenantStatus);

export { router as tenantRoutes };
