/**
 * 坐席管理路由
 */

import { Router } from 'express';
import { agentController } from '../controllers/agent/agent.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 坐席状态管理
router.put('/agents/:agentId/status', agentController.setStatus.bind(agentController));
router.get('/agents/:agentId/status', agentController.getStatus.bind(agentController));
router.get('/agents', agentController.getAgents.bind(agentController));

// 会话分配
router.post('/agents/sessions/distribute', agentController.distributeSession.bind(agentController));
router.post('/agents/sessions/:distributionId/accept', agentController.acceptSession.bind(agentController));
router.post('/agents/sessions/:distributionId/reject', agentController.rejectSession.bind(agentController));
router.post('/agents/sessions/:conversationId/complete', agentController.completeSession.bind(agentController));
router.get('/agents/:agentId/sessions', agentController.getAgentSessions.bind(agentController));
router.get('/agents/sessions/pending', agentController.getPendingSessions.bind(agentController));

// 对话摘要
router.post('/agents/sessions/:conversationId/summary', agentController.generateSummary.bind(agentController));

export { router as agentRoutes };
