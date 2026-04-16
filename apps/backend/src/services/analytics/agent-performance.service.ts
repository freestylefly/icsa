/**
 * 坐席绩效分析服务
 * 统计坐席工作量、响应时间、满意度等指标
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  tenantId: string;
  totalConversations: number;
  resolvedConversations: number;
  resolutionRate: number;
  avgResponseTime: number; // 平均响应时间（秒）
  totalMessages: number;
  avgMessagesPerConversation: number;
  satisfactionScore?: number; // 满意度评分（1-5）
  onlineHours: number; // 在线时长（小时）
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface AgentRanking {
  agentId: string;
  agentName: string;
  score: number;
  rank: number;
}

export class AgentPerformanceService {
  /**
   * 获取坐席绩效统计
   */
  async getAgentPerformance(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgentPerformance> {
    // 获取坐席信息
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        user: true,
      },
    });

    if (!agent) {
      throw new Error(`坐席不存在：${agentId}`);
    }

    // 统计对话数据
    const conversations = await prisma.conversation.findMany({
      where: {
        agentUserId: agentId,
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        messages: true,
      },
    });

    const totalConversations = conversations.length;
    const resolvedConversations = conversations.filter(c => c.status === 'RESOLVED').length;
    const resolutionRate = totalConversations > 0
      ? (resolvedConversations / totalConversations) * 100
      : 0;

    // 计算平均响应时间
    let totalResponseTime = 0;
    let responseCount = 0;

    conversations.forEach(conv => {
      const userMessages = conv.messages.filter(m => m.role === 'USER');
      const assistantMessages = conv.messages.filter(m => m.role === 'ASSISTANT');

      userMessages.forEach(userMsg => {
        const nextAssistantMsg = assistantMessages.find(
          m => m.createdAt > userMsg.createdAt
        );

        if (nextAssistantMsg) {
          const responseTime = (nextAssistantMsg.createdAt.getTime() - userMsg.createdAt.getTime()) / 1000;
          totalResponseTime += responseTime;
          responseCount += 1;
        }
      });
    });

    const avgResponseTime = responseCount > 0
      ? totalResponseTime / responseCount
      : 0;

    // 统计消息数
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const avgMessagesPerConversation = totalConversations > 0
      ? totalMessages / totalConversations
      : 0;

    // TODO: 获取满意度评分（需要从满意度表获取）
    const satisfactionScore = undefined;

    // TODO: 计算在线时长（需要从坐席状态日志获取）
    const onlineHours = 0;

    return {
      agentId,
      agentName: agent.user?.name || agent.name,
      tenantId: agent.tenantId,
      totalConversations,
      resolvedConversations,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      totalMessages,
      avgMessagesPerConversation: Math.round(avgMessagesPerConversation * 100) / 100,
      satisfactionScore,
      onlineHours,
      period: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * 获取所有坐席绩效排名
   */
  async getAgentRanking(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AgentRanking[]> {
    // 获取租户下所有坐席
    const agents = await prisma.agent.findMany({
      where: { tenantId },
      include: {
        user: true,
      },
    });

    // 计算每个坐席的绩效
    const performances = await Promise.all(
      agents.map(agent =>
        this.getAgentPerformance(agent.id, startDate, endDate)
      )
    );

    // 计算综合得分（权重：解决率 40% + 响应时间 30% + 满意度 30%）
    const rankings = performances.map(perf => {
      const resolutionScore = perf.resolutionRate;
      const responseScore = Math.max(0, 100 - perf.avgResponseTime / 10); // 响应时间越短得分越高
      const satisfactionScore = perf.satisfactionScore ? perf.satisfactionScore * 20 : 50; // 假设满意度 1-5 分

      const score = (
        resolutionScore * 0.4 +
        responseScore * 0.3 +
        satisfactionScore * 0.3
      );

      return {
        agentId: perf.agentId,
        agentName: perf.agentName,
        score: Math.round(score * 100) / 100,
        rank: 0, // 稍后计算
      };
    });

    // 按得分排序
    rankings.sort((a, b) => b.score - a.score);

    // 设置排名
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return rankings;
  }

  /**
   * 获取坐席工作量统计（按日）
   */
  async getAgentWorkloadByDay(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    date: string;
    conversations: number;
    messages: number;
    avgResponseTime: number;
  }>> {
    const conversations = await prisma.conversation.findMany({
      where: {
        agentUserId: agentId,
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        messages: true,
      },
    });

    // 按日期聚合
    const dateMap = new Map<string, { conversations: number; messages: number; responseTimes: number[] }>();

    conversations.forEach(conv => {
      const date = conv.startedAt.toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { conversations: 0, messages: 0, responseTimes: [] });
      }

      const data = dateMap.get(date)!;
      data.conversations += 1;
      data.messages += conv.messages.length;

      // 计算响应时间
      const userMessages = conv.messages.filter(m => m.role === 'USER');
      const assistantMessages = conv.messages.filter(m => m.role === 'ASSISTANT');

      userMessages.forEach(userMsg => {
        const nextAssistantMsg = assistantMessages.find(
          m => m.createdAt > userMsg.createdAt
        );

        if (nextAssistantMsg) {
          const responseTime = (nextAssistantMsg.createdAt.getTime() - userMsg.createdAt.getTime()) / 1000;
          data.responseTimes.push(responseTime);
        }
      });
    });

    // 转换为数组
    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        conversations: data.conversations,
        messages: data.messages,
        avgResponseTime: data.responseTimes.length > 0
          ? Math.round((data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length) * 100) / 100
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 获取坐席团队整体统计
   */
  async getTeamStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    avgConversationsPerAgent: number;
    teamResolutionRate: number;
    teamAvgResponseTime: number;
  }> {
    const agents = await prisma.agent.findMany({
      where: { tenantId },
    });

    const performances = await Promise.all(
      agents.map(agent =>
        this.getAgentPerformance(agent.id, startDate, endDate)
      )
    );

    const totalAgents = agents.length;
    const activeAgents = performances.filter(p => p.totalConversations > 0).length;
    const totalConversations = performances.reduce((sum, p) => sum + p.totalConversations, 0);
    const avgConversationsPerAgent = totalAgents > 0
      ? totalConversations / totalAgents
      : 0;

    const totalResolved = performances.reduce((sum, p) => sum + p.resolvedConversations, 0);
    const teamResolutionRate = totalConversations > 0
      ? (totalResolved / totalConversations) * 100
      : 0;

    const totalResponseTime = performances.reduce((sum, p) => sum + p.avgResponseTime * p.totalConversations, 0);
    const teamAvgResponseTime = totalConversations > 0
      ? totalResponseTime / totalConversations
      : 0;

    return {
      totalAgents,
      activeAgents,
      totalConversations,
      avgConversationsPerAgent: Math.round(avgConversationsPerAgent * 100) / 100,
      teamResolutionRate: Math.round(teamResolutionRate * 100) / 100,
      teamAvgResponseTime: Math.round(teamAvgResponseTime * 100) / 100,
    };
  }
}

// 单例
export const agentPerformanceService = new AgentPerformanceService();
