/**
 * 坐席管理控制器
 * 处理坐席状态、会话分配、对话摘要等请求
 */

import { Request, Response, NextFunction } from 'express';
import { agentStatusService, AgentStatus } from '../services/agent/agent-status.service';
import { sessionDistributionService, DistributionStrategy } from '../services/agent/session-distribution.service';
import { summaryGeneratorService } from '../services/agent/summary-generator.service';
import { conversationService } from '../services/conversation/conversation.service';
import { logger } from '../../utils/logger';

export class AgentController {
  /**
   * 设置坐席状态
   * PUT /api/agents/:agentId/status
   */
  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const { status, metadata } = req.body;

      // 从请求中获取租户 ID 和用户 ID（通常从 JWT token 中获取）
      const tenantId = req.headers['x-tenant-id'] as string;
      const userId = req.user?.id; // 假设 auth middleware 已设置

      if (!tenantId || !userId) {
        return res.status(400).json({
          error: '缺少租户 ID 或用户 ID',
        });
      }

      const session = await agentStatusService.setAgentStatus(
        agentId,
        tenantId,
        userId,
        status as AgentStatus,
        metadata
      );

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error('设置坐席状态失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席状态
   * GET /api/agents/:agentId/status
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const session = await agentStatusService.getAgentStatus(agentId);

      if (!session) {
        return res.status(404).json({
          error: '坐席不存在或未在线',
        });
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      logger.error('获取坐席状态失败', { error });
      next(error);
    }
  }

  /**
   * 获取租户下所有坐席
   * GET /api/agents
   */
  async getAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const { status } = req.query;
      let agents;

      if (status === 'online') {
        agents = await agentStatusService.getOnlineAgents(tenantId);
      } else {
        agents = await agentStatusService.getAllAgents(tenantId);
      }

      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      logger.error('获取坐席列表失败', { error });
      next(error);
    }
  }

  /**
   * 分配会话给坐席
   * POST /api/agents/sessions/distribute
   */
  async distributeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId, strategy = 'load_balance', requiredSkills } = req.body;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!conversationId || !tenantId) {
        return res.status(400).json({
          error: '缺少对话 ID 或租户 ID',
        });
      }

      const distribution = await sessionDistributionService.distributeSession(
        conversationId,
        tenantId,
        strategy as DistributionStrategy,
        requiredSkills
      );

      if (!distribution) {
        return res.status(200).json({
          success: true,
          data: null,
          message: '没有可用坐席，已加入等待队列',
        });
      }

      res.json({
        success: true,
        data: distribution,
      });
    } catch (error) {
      logger.error('分配会话失败', { error });
      next(error);
    }
  }

  /**
   * 坐席接受会话
   * POST /api/agents/sessions/:distributionId/accept
   */
  async acceptSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { distributionId } = req.params;
      await sessionDistributionService.acceptSession(distributionId);

      res.json({
        success: true,
      });
    } catch (error) {
      logger.error('接受会话失败', { error });
      next(error);
    }
  }

  /**
   * 坐席拒绝会话
   * POST /api/agents/sessions/:distributionId/reject
   */
  async rejectSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { distributionId } = req.params;
      const { reason } = req.body;

      await sessionDistributionService.rejectSession(distributionId, reason);

      res.json({
        success: true,
      });
    } catch (error) {
      logger.error('拒绝会话失败', { error });
      next(error);
    }
  }

  /**
   * 完成会话
   * POST /api/agents/sessions/:conversationId/complete
   */
  async completeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      await sessionDistributionService.completeSession(conversationId);

      res.json({
        success: true,
      });
    } catch (error) {
      logger.error('完成会话失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席的会话分配列表
   * GET /api/agents/:agentId/sessions
   */
  async getAgentSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const distributions = await sessionDistributionService.getDistributionsForAgent(agentId);

      res.json({
        success: true,
        data: distributions,
      });
    } catch (error) {
      logger.error('获取坐席会话列表失败', { error });
      next(error);
    }
  }

  /**
   * 生成对话摘要
   * POST /api/agents/sessions/:conversationId/summary
   */
  async generateSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;

      // 获取对话消息
      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({
          error: '对话不存在',
        });
      }

      const messages = conversation.messages || [];
      
      // 转换为摘要服务需要的格式
      const formattedMessages = messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        createdAt: m.createdAt.getTime(),
      }));

      const summary = await summaryGeneratorService.generateSummary(
        conversationId,
        formattedMessages
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('生成对话摘要失败', { error });
      next(error);
    }
  }

  /**
   * 获取等待队列中的会话
   * GET /api/agents/sessions/pending
   */
  async getPendingSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const sessions = await sessionDistributionService.getPendingSessions(tenantId);

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      logger.error('获取等待队列失败', { error });
      next(error);
    }
  }
}

// 单例
export const agentController = new AgentController();
