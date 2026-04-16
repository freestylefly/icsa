/**
 * 会话分配服务
 * 实现会话分配策略：轮询、负载均衡、技能匹配
 */

import { createClient } from 'redis';
import { logger } from '../../utils/logger';
import { agentStatusService, AgentSession } from './agent-status.service';

export type DistributionStrategy = 'round_robin' | 'load_balance' | 'skill_based';

export interface SessionDistribution {
  id: string;
  conversationId: string;
  tenantId: string;
  agentId: string;
  strategy: DistributionStrategy;
  distributedAt: number;
  acceptedAt?: number;
  rejectedAt?: number;
  reason?: string;
}

export class SessionDistributionService {
  private redis: ReturnType<typeof createClient>;
  private readonly DISTRIBUTION_PREFIX = 'session:distribution:';
  private readonly PENDING_QUEUE = 'session:pending:queue';
  private readonly ROUND_ROBIN_KEY = 'session:round_robin:index';

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.redis.on('error', (err) => {
      logger.error('Redis 连接错误', { error: err });
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.redis.connect();
      logger.info('Redis 会话分配服务已连接');
    } catch (error) {
      logger.error('Redis 连接失败', { error });
    }
  }

  /**
   * 分配会话给坐席
   */
  async distributeSession(
    conversationId: string,
    tenantId: string,
    strategy: DistributionStrategy = 'load_balance',
    requiredSkills?: string[]
  ): Promise<SessionDistribution | null> {
    let targetAgent: AgentSession | null = null;

    switch (strategy) {
      case 'round_robin':
        targetAgent = await this.selectAgentRoundRobin(tenantId);
        break;
      case 'load_balance':
        targetAgent = await this.selectAgentLoadBalance(tenantId);
        break;
      case 'skill_based':
        targetAgent = await this.selectAgentBySkills(tenantId, requiredSkills || []);
        break;
      default:
        targetAgent = await this.selectAgentLoadBalance(tenantId);
    }

    if (!targetAgent) {
      // 没有可用坐席，加入等待队列
      await this.addToPendingQueue(conversationId, tenantId, strategy, requiredSkills);
      logger.warn('没有可用坐席，会话已加入等待队列', { conversationId, tenantId });
      return null;
    }

    // 创建分配记录
    const distribution: SessionDistribution = {
      id: this.generateDistributionId(conversationId, targetAgent.agentId),
      conversationId,
      tenantId,
      agentId: targetAgent.agentId,
      strategy,
      distributedAt: Date.now(),
    };

    // 保存分配记录
    await this.saveDistribution(distribution);

    // 增加坐席会话计数
    await agentStatusService.incrementSessionCount(targetAgent.agentId);

    // 更新轮询索引
    await this.updateRoundRobinIndex(tenantId, targetAgent.agentId);

    logger.info('会话已分配', {
      conversationId,
      agentId: targetAgent.agentId,
      strategy,
    });

    return distribution;
  }

  /**
   * 坐席接受会话
   */
  async acceptSession(distributionId: string): Promise<void> {
    const distribution = await this.getDistribution(distributionId);
    if (!distribution) {
      throw new Error(`分配记录不存在：${distributionId}`);
    }

    distribution.acceptedAt = Date.now();
    await this.saveDistribution(distribution);

    logger.info('坐席已接受会话', { distributionId, agentId: distribution.agentId });
  }

  /**
   * 坐席拒绝会话
   */
  async rejectSession(distributionId: string, reason?: string): Promise<void> {
    const distribution = await this.getDistribution(distributionId);
    if (!distribution) {
      throw new Error(`分配记录不存在：${distributionId}`);
    }

    distribution.rejectedAt = Date.now();
    distribution.reason = reason;
    await this.saveDistribution(distribution);

    // 减少坐席会话计数
    await agentStatusService.decrementSessionCount(distribution.agentId);

    // 重新分配会话
    await this.distributeSession(
      distribution.conversationId,
      distribution.tenantId,
      distribution.strategy
    );

    logger.info('坐席已拒绝会话', { distributionId, agentId: distribution.agentId, reason });
  }

  /**
   * 完成会话
   */
  async completeSession(conversationId: string): Promise<void> {
    // 查找对应的分配记录
    const key = `${this.DISTRIBUTION_PREFIX}${conversationId}`;
    const keys = await this.redis.keys(`${key}:*`);

    for (const distributionKey of keys) {
      const data = await this.redis.get(distributionKey);
      if (data) {
        const distribution = JSON.parse(data) as SessionDistribution;
        // 减少坐席会话计数
        await agentStatusService.decrementSessionCount(distribution.agentId);
        logger.info('会话已完成', { conversationId, agentId: distribution.agentId });
      }
    }
  }

  /**
   * 获取坐席的会话分配列表
   */
  async getDistributionsForAgent(agentId: string): Promise<SessionDistribution[]> {
    const pattern = `${this.DISTRIBUTION_PREFIX}*`;
    const keys = await this.redis.keys(pattern);
    const distributions: SessionDistribution[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const distribution = JSON.parse(data) as SessionDistribution;
        if (distribution.agentId === agentId) {
          distributions.push(distribution);
        }
      }
    }

    // 按分配时间倒序排列
    distributions.sort((a, b) => b.distributedAt - a.distributedAt);
    return distributions;
  }

  /**
   * 获取等待队列中的会话
   */
  async getPendingSessions(tenantId?: string): Promise<Array<{
    conversationId: string;
    tenantId: string;
    strategy: DistributionStrategy;
    requiredSkills?: string[];
    queuedAt: number;
  }>> {
    const pending = await this.redis.lRange(this.PENDING_QUEUE, 0, -1);
    const sessions = pending.map(item => JSON.parse(item));

    if (tenantId) {
      return sessions.filter(s => s.tenantId === tenantId);
    }

    return sessions;
  }

  /**
   * 轮询策略：选择下一个坐席
   */
  private async selectAgentRoundRobin(tenantId: string): Promise<AgentSession | null> {
    const onlineAgents = await agentStatusService.getOnlineAgents(tenantId);
    
    if (onlineAgents.length === 0) {
      return null;
    }

    // 获取当前轮询索引
    const currentIndex = await this.getCurrentRoundRobinIndex(tenantId);
    const nextIndex = (currentIndex + 1) % onlineAgents.length;

    return onlineAgents[nextIndex];
  }

  /**
   * 负载均衡策略：选择负载最轻的坐席
   */
  private async selectAgentLoadBalance(tenantId: string): Promise<AgentSession | null> {
    return await agentStatusService.getAvailableAgent(tenantId);
  }

  /**
   * 技能匹配策略：选择有对应技能的坐席
   */
  private async selectAgentBySkills(
    tenantId: string,
    requiredSkills: string[]
  ): Promise<AgentSession | null> {
    const onlineAgents = await agentStatusService.getOnlineAgents(tenantId);
    
    if (onlineAgents.length === 0) {
      return null;
    }

    // 过滤有对应技能的坐席
    const matchedAgents = onlineAgents.filter(agent => {
      const agentSkills = agent.metadata?.skills || [];
      return requiredSkills.every(skill => agentSkills.includes(skill));
    });

    if (matchedAgents.length === 0) {
      // 没有匹配技能的坐席，返回任意可用坐席
      return agentStatusService.getAvailableAgent(tenantId);
    }

    // 在匹配的坐席中选择负载最轻的
    matchedAgents.sort((a, b) => a.currentSessions - b.currentSessions);
    return matchedAgents[0];
  }

  /**
   * 添加到等待队列
   */
  private async addToPendingQueue(
    conversationId: string,
    tenantId: string,
    strategy: DistributionStrategy,
    requiredSkills?: string[]
  ): Promise<void> {
    const item = {
      conversationId,
      tenantId,
      strategy,
      requiredSkills,
      queuedAt: Date.now(),
    };

    await this.redis.lPush(this.PENDING_QUEUE, JSON.stringify(item));
  }

  /**
   * 获取当前轮询索引
   */
  private async getCurrentRoundRobinIndex(tenantId: string): Promise<number> {
    const key = `${this.ROUND_ROBIN_KEY}:${tenantId}`;
    const data = await this.redis.get(key);
    return data ? parseInt(data, 10) : 0;
  }

  /**
   * 更新轮询索引
   */
  private async updateRoundRobinIndex(tenantId: string, agentId: string): Promise<void> {
    const key = `${this.ROUND_ROBIN_KEY}:${tenantId}`;
    const currentIndex = await this.getCurrentRoundRobinIndex(tenantId);
    await this.redis.set(key, (currentIndex + 1).toString());
  }

  /**
   * 保存分配记录
   */
  private async saveDistribution(distribution: SessionDistribution): Promise<void> {
    const key = this.getDistributionKey(distribution.conversationId, distribution.id);
    await this.redis.set(key, JSON.stringify(distribution));
  }

  /**
   * 获取分配记录
   */
  private async getDistribution(distributionId: string): Promise<SessionDistribution | null> {
    // 需要遍历查找（简化实现）
    const pattern = `${this.DISTRIBUTION_PREFIX}*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const distribution = JSON.parse(data) as SessionDistribution;
        if (distribution.id === distributionId) {
          return distribution;
        }
      }
    }

    return null;
  }

  private getDistributionKey(conversationId: string, distributionId: string): string {
    return `${this.DISTRIBUTION_PREFIX}${conversationId}:${distributionId}`;
  }

  private generateDistributionId(conversationId: string, agentId: string): string {
    return `dist_${conversationId}_${agentId}_${Date.now()}`;
  }
}

// 单例
export const sessionDistributionService = new SessionDistributionService();
