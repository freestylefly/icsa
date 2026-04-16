/**
 * 认证路由
 */

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 公开路由（无需认证）
router.post('/register', authController.register);
router.post('/login', authController.login);

// 需要认证的路由
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

export { router as authRoutes };
