/**
 * 对话管理路由
 */

import { Router } from 'express';
import { conversationController } from '../controllers/conversation/conversation.controller';
import { handoffController } from '../controllers/human-handoff/handoff.controller';

const router = Router();

// ==================== 会话管理 ====================

// 创建会话
router.post('/sessions', conversationController.createSession.bind(conversationController));

// 获取会话
router.get('/sessions/:sessionId', conversationController.getSession.bind(conversationController));

// 关闭会话
router.post('/sessions/:sessionId/close', conversationController.closeSession.bind(conversationController));

// 获取活跃会话列表
router.get('/sessions/active', conversationController.getActiveSessions.bind(conversationController));

// ==================== 对话消息 ====================

// 发送消息（非流式）
router.post('/messages', conversationController.sendMessage.bind(conversationController));

// 发送消息（SSE 流式）
router.get('/messages/stream', conversationController.sendMessageStream.bind(conversationController));

// 获取对话历史
router.get('/:sessionId/history', conversationController.getHistory.bind(conversationController));

// 清空对话历史
router.delete('/:sessionId/history', conversationController.clearHistory.bind(conversationController));

// ==================== 转人工 ====================

// 创建转人工请求
router.post('/handoffs', handoffController.createHandoff.bind(handoffController));

// 获取工单
router.get('/handoffs/:ticketId', handoffController.getTicket.bind(handoffController));

// 分配工单
router.post('/handoffs/:ticketId/assign', handoffController.assignTicket.bind(handoffController));

// 接受工单
router.post('/handoffs/:ticketId/accept', handoffController.acceptTicket.bind(handoffController));

// 关闭工单
router.post('/handoffs/:ticketId/close', handoffController.closeTicket.bind(handoffController));

// 获取待处理工单
router.get('/handoffs/pending', handoffController.getPendingTickets.bind(handoffController));

// 获取坐席工单
router.get('/handoffs/agents/:agentId/tickets', handoffController.getAgentTickets.bind(handoffController));

// ==================== 坐席管理 ====================

// 坐席上线
router.post('/handoffs/agents/:agentId/online', handoffController.agentOnline.bind(handoffController));

// 坐席下线
router.post('/handoffs/agents/:agentId/offline', handoffController.agentOffline.bind(handoffController));

// 坐席心跳
router.post('/handoffs/agents/:agentId/heartbeat', handoffController.agentHeartbeat.bind(handoffController));

// 获取统计
router.get('/handoffs/stats', handoffController.getStats.bind(handoffController));

export { router as conversationRoutes };
