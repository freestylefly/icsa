/**
 * 数据分析控制器
 * 处理对话统计、坐席绩效、满意度等数据分析请求
 */

import { Request, Response, NextFunction } from 'express';
import { conversationAnalyticsService } from '../../services/analytics/conversation-analytics.service';
import { agentPerformanceService } from '../../services/analytics/agent-performance.service';
import { satisfactionService } from '../../services/analytics/satisfaction.service';
import { logger } from '../../utils/logger';

export class AnalyticsController {
  /**
   * 获取对话统计
   * GET /api/analytics/conversations
   */
  async getConversationStats(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { startDate, endDate } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const stats = await conversationAnalyticsService.getConversationStats(
        tenantId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('获取对话统计失败', { error });
      next(error);
    }
  }

  /**
   * 获取对话趋势
   * GET /api/analytics/conversations/trend
   */
  async getConversationTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { granularity = 'day', days = 30 } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const trend = await conversationAnalyticsService.getConversationTrend(
        tenantId,
        granularity as 'day' | 'week' | 'month',
        parseInt(days as string, 10)
      );

      res.json({
        success: true,
        data: trend,
      });
    } catch (error) {
      logger.error('获取对话趋势失败', { error });
      next(error);
    }
  }

  /**
   * 获取常见问题 TOP10
   * GET /api/analytics/faq/top
   */
  async getTopFAQs(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { limit = 10, days = 30 } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const faqs = await conversationAnalyticsService.getTopFAQs(
        tenantId,
        parseInt(limit as string, 10),
        parseInt(days as string, 10)
      );

      res.json({
        success: true,
        data: faqs,
      });
    } catch (error) {
      logger.error('获取常见问题失败', { error });
      next(error);
    }
  }

  /**
   * 获取响应时间统计
   * GET /api/analytics/response-time
   */
  async getResponseTimeStats(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { days = 30 } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const stats = await conversationAnalyticsService.getResponseTimeStats(
        tenantId,
        parseInt(days as string, 10)
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('获取响应时间统计失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席绩效
   * GET /api/analytics/agents/:agentId/performance
   */
  async getAgentPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: '缺少开始日期或结束日期',
        });
      }

      const performance = await agentPerformanceService.getAgentPerformance(
        agentId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: performance,
      });
    } catch (error) {
      logger.error('获取坐席绩效失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席排名
   * GET /api/analytics/agents/ranking
   */
  async getAgentRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { startDate, endDate } = req.query;

      if (!tenantId || !startDate || !endDate) {
        return res.status(400).json({
          error: '缺少租户 ID 或日期范围',
        });
      }

      const ranking = await agentPerformanceService.getAgentRanking(
        tenantId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: ranking,
      });
    } catch (error) {
      logger.error('获取坐席排名失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席团队统计
   * GET /api/analytics/agents/team-stats
   */
  async getTeamStats(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { startDate, endDate } = req.query;

      if (!tenantId || !startDate || !endDate) {
        return res.status(400).json({
          error: '缺少租户 ID 或日期范围',
        });
      }

      const stats = await agentPerformanceService.getTeamStats(
        tenantId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('获取团队统计失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席工作量（按日）
   * GET /api/analytics/agents/:agentId/workload
   */
  async getAgentWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: '缺少开始日期或结束日期',
        });
      }

      const workload = await agentPerformanceService.getAgentWorkloadByDay(
        agentId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: workload,
      });
    } catch (error) {
      logger.error('获取坐席工作量失败', { error });
      next(error);
    }
  }

  /**
   * 获取满意度统计
   * GET /api/analytics/satisfaction
   */
  async getSatisfactionStats(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { startDate, endDate } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const stats = await satisfactionService.getSatisfactionStats(
        tenantId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('获取满意度统计失败', { error });
      next(error);
    }
  }

  /**
   * 获取坐席满意度
   * GET /api/analytics/agents/:agentId/satisfaction
   */
  async getAgentSatisfaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentId } = req.params;
      const { startDate, endDate } = req.query;

      const stats = await satisfactionService.getAgentSatisfactionStats(
        agentId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('获取坐席满意度失败', { error });
      next(error);
    }
  }

  /**
   * 提交满意度评价
   * POST /api/analytics/satisfaction/rating
   */
  async submitRating(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId, rating, comment, tags } = req.body;
      const tenantId = req.headers['x-tenant-id'] as string;
      const agentId = req.body.agentId;

      if (!conversationId || !rating || !tenantId) {
        return res.status(400).json({
          error: '缺少必要参数',
        });
      }

      const result = await satisfactionService.submitRating({
        conversationId,
        tenantId,
        agentId,
        rating,
        comment,
        tags,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('提交满意度评价失败', { error });
      next(error);
    }
  }

  /**
   * 获取最近的评价
   * GET /api/analytics/satisfaction/recent
   */
  async getRecentRatings(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { limit = 20 } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          error: '缺少租户 ID',
        });
      }

      const ratings = await satisfactionService.getRecentRatings(
        tenantId,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: ratings,
      });
    } catch (error) {
      logger.error('获取最近评价失败', { error });
      next(error);
    }
  }
}

// 单例
export const analyticsController = new AnalyticsController();
