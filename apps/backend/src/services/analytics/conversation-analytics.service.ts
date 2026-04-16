/**
 * 对话数据分析服务
 * 提供对话统计、趋势分析、常见问题等功能
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  transferredConversations: number;
  avgDuration: number; // 平均对话时长（秒）
  resolutionRate: number; // 解决率
  transferRate: number; // 转人工率
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface ConversationTrend {
  dates: string[];
  total: number[];
  resolved: number[];
  transferred: number[];
}

export interface FAQItem {
  question: string;
  count: number;
  category?: string;
}

export class ConversationAnalyticsService {
  /**
   * 获取对话统计（总计）
   */
  async getConversationStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ConversationStats> {
    const where: any = { tenantId };

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    const [total, active, resolved, transferred] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.conversation.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.conversation.count({ where: { ...where, status: 'TRANSFERRED' } }),
    ]);

    // 计算平均对话时长
    const conversations = await prisma.conversation.findMany({
      where,
      select: {
        startedAt: true,
        endedAt: true,
      },
      take: 1000,
    });

    const durations = conversations
      .filter(c => c.endedAt)
      .map(c => (c.endedAt!.getTime() - c.startedAt.getTime()) / 1000);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;
    const transferRate = total > 0 ? (transferred / total) * 100 : 0;

    return {
      totalConversations: total,
      activeConversations: active,
      resolvedConversations: resolved,
      transferredConversations: transferred,
      avgDuration: Math.round(avgDuration),
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      transferRate: Math.round(transferRate * 100) / 100,
    };
  }

  /**
   * 获取对话趋势（按日/周/月）
   */
  async getConversationTrend(
    tenantId: string,
    granularity: 'day' | 'week' | 'month' = 'day',
    days: number = 30
  ): Promise<ConversationTrend> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = {
      tenantId,
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // 按日期分组统计
    const conversations = await prisma.conversation.findMany({
      where,
      select: {
        startedAt: true,
        status: true,
      },
    });

    // 按日期聚合
    const dateMap = new Map<string, { total: number; resolved: number; transferred: number }>();

    // 初始化所有日期
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date, granularity);
      dateMap.set(dateStr, { total: 0, resolved: 0, transferred: 0 });
    }

    // 统计对话
    conversations.forEach(conv => {
      const dateStr = this.formatDate(conv.startedAt, granularity);
      const data = dateMap.get(dateStr);
      if (data) {
        data.total += 1;
        if (conv.status === 'RESOLVED') data.resolved += 1;
        if (conv.status === 'TRANSFERRED') data.transferred += 1;
      }
    });

    // 转换为数组（按时间正序）
    const sortedDates = Array.from(dateMap.keys()).sort();
    
    return {
      dates: sortedDates,
      total: sortedDates.map(d => dateMap.get(d)!.total),
      resolved: sortedDates.map(d => dateMap.get(d)!.resolved),
      transferred: sortedDates.map(d => dateMap.get(d)!.transferred),
    };
  }

  /**
   * 获取常见问题 TOP10
   */
  async getTopFAQs(
    tenantId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<FAQItem[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 从消息中提取用户问题（意图）
    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          tenantId,
          startedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        role: 'USER',
        intent: {
          not: null,
        },
      },
      select: {
        content: true,
        intent: true,
        confidence: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000,
    });

    // 按意图分组统计
    const intentMap = new Map<string, { question: string; count: number; category?: string }>();

    messages.forEach(msg => {
      if (msg.intent) {
        const existing = intentMap.get(msg.intent);
        if (existing) {
          existing.count += 1;
        } else {
          intentMap.set(msg.intent, {
            question: msg.content,
            count: 1,
            category: msg.intent,
          });
        }
      }
    });

    // 转换为数组并排序
    const faqs = Array.from(intentMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return faqs;
  }

  /**
   * 获取响应时间统计
   */
  async getResponseTimeStats(
    tenantId: string,
    days: number = 30
  ): Promise<{
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    responseTimeTrend: TimeSeriesData[];
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取对话和消息
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // 计算每个对话的平均响应时间
    const responseTimes: number[] = [];
    const dailyResponseTimes = new Map<string, number[]>();

    conversations.forEach(conv => {
      const userMessages = conv.messages.filter(m => m.role === 'USER');
      const assistantMessages = conv.messages.filter(m => m.role === 'ASSISTANT');

      let totalResponseTime = 0;
      let responseCount = 0;

      userMessages.forEach((userMsg, index) => {
        // 找到用户消息后的第一条助手消息
        const nextAssistantMsg = assistantMessages.find(
          m => m.createdAt > userMsg.createdAt
        );

        if (nextAssistantMsg) {
          const responseTime = (nextAssistantMsg.createdAt.getTime() - userMsg.createdAt.getTime()) / 1000;
          totalResponseTime += responseTime;
          responseCount += 1;

          // 按日期统计
          const dateStr = this.formatDate(userMsg.createdAt, 'day');
          if (!dailyResponseTimes.has(dateStr)) {
            dailyResponseTimes.set(dateStr, []);
          }
          dailyResponseTimes.get(dateStr)!.push(responseTime);
        }
      });

      if (responseCount > 0) {
        responseTimes.push(totalResponseTime / responseCount);
      }
    });

    // 计算统计值
    responseTimes.sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    // 按日期聚合
    const responseTimeTrend: TimeSeriesData[] = Array.from(dailyResponseTimes.entries())
      .map(([date, times]) => ({
        date,
        value: times.reduce((a, b) => a + b, 0) / times.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
      responseTimeTrend,
    };
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date, granularity: 'day' | 'week' | 'month'): string {
    switch (granularity) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }
}

// 单例
export const conversationAnalyticsService = new ConversationAnalyticsService();
