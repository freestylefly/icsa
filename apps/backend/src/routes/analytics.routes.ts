/**
 * 数据分析路由
 */

import { Router } from 'express';
import { analyticsController } from '../controllers/analytics/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// 对话统计
router.get('/analytics/conversations', analyticsController.getConversationStats.bind(analyticsController));
router.get('/analytics/conversations/trend', analyticsController.getConversationTrend.bind(analyticsController));
router.get('/analytics/faq/top', analyticsController.getTopFAQs.bind(analyticsController));
router.get('/analytics/response-time', analyticsController.getResponseTimeStats.bind(analyticsController));

// 坐席绩效
router.get('/analytics/agents/:agentId/performance', analyticsController.getAgentPerformance.bind(analyticsController));
router.get('/analytics/agents/ranking', analyticsController.getAgentRanking.bind(analyticsController));
router.get('/analytics/agents/team-stats', analyticsController.getTeamStats.bind(analyticsController));
router.get('/analytics/agents/:agentId/workload', analyticsController.getAgentWorkload.bind(analyticsController));

// 满意度
router.get('/analytics/satisfaction', analyticsController.getSatisfactionStats.bind(analyticsController));
router.get('/analytics/agents/:agentId/satisfaction', analyticsController.getAgentSatisfaction.bind(analyticsController));
router.post('/analytics/satisfaction/rating', analyticsController.submitRating.bind(analyticsController));
router.get('/analytics/satisfaction/recent', analyticsController.getRecentRatings.bind(analyticsController));

export { router as analyticsRoutes };
