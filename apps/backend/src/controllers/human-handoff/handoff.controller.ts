/**
 * 转人工控制器
 */

import { Request, Response, NextFunction } from 'express';
import { handoffService, HandoffStatus } from '../../services/human-handoff/handoff.service';
import { queueManager } from '../../services/human-handoff/queue-manager.service';
import { logger } from '../../utils/logger';

export class HandoffController {
  /**
   * 创建转人工请求
   * POST /api/conversations/handoffs
   */
  async createHandoff(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, tenantId, userId, reason, reasonDetail, priority } = req.body;

      if (!sessionId || !tenantId || !reason) {
        return res.status(400).json({ error: 'sessionId, tenantId 和 reason 是必填项' });
      }

      const ticket = await handoffService.createHandoff({
        sessionId,
        tenantId,
        userId,
        reason,
        reasonDetail,
        priority,
      });

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('创建转人工请求失败', { error });
      next(error);
    }
  }

  /**
   * 获取工单
   * GET /api/conversations/handoffs/:ticketId
   */
  async getTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;

      const ticket = await handoffService.getTicket(ticketId);

      if (!ticket) {
        return res.status(404).json({ error: '工单不存在' });
      }

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('获取工单失败', { error });
      next(error);
    }
  }

  /**
   * 分配工单给坐席
   * POST /api/conversations/handoffs/:ticketId/assign
   */
  async assignTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;
      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: 'agentId 是必填项' });
      }

      await handoffService.assignTicket(ticketId, agentId);

      res.json({
        success: true,
        message: '工单已分配',
      });
    } catch (error: any) {
      logger.error('分配工单失败', { error });
      next(error);
    }
  }

  /**
   * 坐席接受工单
   * POST /api/conversations/handoffs/:ticketId/accept
   */
  async acceptTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;

      await handoffService.acceptTicket(ticketId);

      res.json({
        success: true,
        message: '工单已接受',
      });
    } catch (error: any) {
      logger.error('接受工单失败', { error });
      next(error);
    }
  }

  /**
   * 关闭工单
   * POST /api/conversations/handoffs/:ticketId/close
   */
  async closeTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.params;

      await handoffService.closeTicket(ticketId);

      res.json({
        success: true,
        message: '工单已关闭',
      });
    } catch (error: any) {
      logger.error('关闭工单失败', { error });
      next(error);
    }
  }

  /**
   * 获取待处理工单列表
   * GET /api/conversations/handoffs/pending?tenantId=xxx
   */
  async getPendingTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId 是必填项' });
      }

      const tickets = await handoffService.getPendingTicketsForTenant(tenantId as string);

      res.json({
        success: true,
        data: {
          tickets,
          count: tickets.length,
        },
      });
    } catch (error: any) {
      logger.error('获取待处理工单失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席的工单列表
   * GET /api/conversations/handoffs/agents/:agentId/tickets?status=xxx
   */
  async getAgentTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const { status } = req.query;

      const tickets = await handoffService.getTicketsForAgent(
        agentId,
        status as HandoffStatus | undefined
      );

      res.json({
        success: true,
        data: {
          tickets,
          count: tickets.length,
        },
      });
    } catch (error: any) {
      logger.error('获取坐席工单失败', { error });
      next(error);
    }
  }

  /**
   * 坐席上线
   * POST /api/conversations/handoffs/agents/:agentId/online
   */
  async agentOnline(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const { tenantId, maxLoad = 10, skills } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId 是必填项' });
      }

      await queueManager.registerAgent({
        agentId,
        tenantId,
        status: 'online',
        currentLoad: 0,
        maxLoad,
        lastHeartbeat: Date.now(),
        skills,
      });

      res.json({
        success: true,
        message: '坐席已上线',
      });
    } catch (error: any) {
      logger.error('坐席上线失败', { error });
      next(error);
    }
  }

  /**
   * 坐席下线
   * POST /api/conversations/handoffs/agents/:agentId/offline
   */
  async agentOffline(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;

      await queueManager.unregisterAgent(agentId);

      res.json({
        success: true,
        message: '坐席已下线',
      });
    } catch (error: any) {
      logger.error('坐席下线失败', { error });
      next(error);
    }
  }

  /**
   * 坐席心跳
   * POST /api/conversations/handoffs/agents/:agentId/heartbeat
   */
  async agentHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;

      await queueManager.heartbeat(agentId);

      res.json({
        success: true,
        message: '心跳已接收',
      });
    } catch (error: any) {
      logger.error('坐席心跳失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席统计
   * GET /api/conversations/handoffs/stats?tenantId=xxx
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId 是必填项' });
      }

      const stats = await queueManager.getAgentStats(tenantId as string);
      const queueSize = await handoffService.getQueueSize();

      res.json({
        success: true,
        data: {
          ...stats,
          queueSize,
        },
      });
    } catch (error: any) {
      logger.error('获取统计失败', { error });
      next(error);
    }
  }
}

// 单例
export const handoffController = new HandoffController();
