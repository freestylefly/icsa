/**
 * 对话管理控制器
 */

import { Request, Response, NextFunction } from 'express';
import { conversationService, ConversationRequest } from '../../services/conversation/conversation.service';
import { historyManager } from '../../services/conversation/history-manager.service';
import { sessionManager, SessionStatus } from '../../services/conversation/session-manager.service';
import { logger } from '../../utils/logger';

export class ConversationController {
  /**
   * 创建会话
   * POST /api/conversations/sessions
   */
  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, userId, agentId, metadata } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId 是必填项' });
      }

      const session = await sessionManager.createSession(tenantId, userId, agentId, metadata);

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error: any) {
      logger.error('创建会话失败', { error });
      next(error);
    }
  }

  /**
   * 获取会话
   * GET /api/conversations/sessions/:sessionId
   */
  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;

      const session = await sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error: any) {
      logger.error('获取会话失败', { error });
      next(error);
    }
  }

  /**
   * 关闭会话
   * POST /api/conversations/sessions/:sessionId/close
   */
  async closeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;

      await sessionManager.closeSession(sessionId);

      res.json({
        success: true,
        message: '会话已关闭',
      });
    } catch (error: any) {
      logger.error('关闭会话失败', { error });
      next(error);
    }
  }

  /**
   * 发送消息（非流式）
   * POST /api/conversations/messages
   */
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const request: ConversationRequest = {
        tenantId: req.body.tenantId,
        userId: req.body.userId,
        sessionId: req.body.sessionId,
        message: req.body.message,
        agentId: req.body.agentId,
      };

      if (!request.tenantId || !request.message) {
        return res.status(400).json({ error: 'tenantId 和 message 是必填项' });
      }

      const response = await conversationService.processMessage(request);

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error('发送消息失败', { error });
      next(error);
    }
  }

  /**
   * 发送消息（SSE 流式）
   * GET /api/conversations/messages/stream
   */
  async sendMessageStream(req: Request, res: Response, next: NextFunction) {
    try {
      const request: ConversationRequest = {
        tenantId: req.query.tenantId as string,
        userId: req.query.userId as string,
        sessionId: req.query.sessionId as string,
        message: req.query.message as string,
        agentId: req.query.agentId as string,
      };

      if (!request.tenantId || !request.message) {
        return res.status(400).json({ error: 'tenantId 和 message 是必填项' });
      }

      // 设置 SSE 头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let sessionId = '';

      await conversationService.processMessageStream(request, {
        onToken: (token) => {
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
        },
        onComplete: (fullResponse, sources) => {
          res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            content: fullResponse,
            sources,
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        },
      });
    } catch (error: any) {
      logger.error('流式消息失败', { error });
      next(error);
    }
  }

  /**
   * 获取对话历史
   * GET /api/conversations/:sessionId/history
   */
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;

      const messages = await historyManager.getHistory(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          messages,
        },
      });
    } catch (error: any) {
      logger.error('获取历史失败', { error });
      next(error);
    }
  }

  /**
   * 清空对话历史
   * DELETE /api/conversations/:sessionId/history
   */
  async clearHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;

      await historyManager.clearHistory(sessionId);

      res.json({
        success: true,
        message: '历史已清空',
      });
    } catch (error: any) {
      logger.error('清空历史失败', { error });
      next(error);
    }
  }

  /**
   * 获取活跃会话列表
   * GET /api/conversations/sessions/active?tenantId=xxx
   */
  async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId 是必填项' });
      }

      const sessions = await sessionManager.getActiveSessions(tenantId as string);

      res.json({
        success: true,
        data: {
          sessions,
          count: sessions.length,
        },
      });
    } catch (error: any) {
      logger.error('获取活跃会话失败', { error });
      next(error);
    }
  }
}

// 单例
export const conversationController = new ConversationController();
