/**
 * 坐席状态管理服务
 * 管理客服坐席的在线状态、负载情况
 */

import { createClient } from 'redis';
import { logger } from '../../utils/logger';

export type AgentStatus = 'online' | 'busy' | 'offline' | 'break';

export interface AgentSession {
  agentId: string;
  tenantId: string;
  userId: string;
  status: AgentStatus;
  maxConcurrentSessions: number; // 最大并发会话数
  currentSessions: number;       // 当前会话数
  lastActiveAt: number;
  metadata?: {
    nickname?: string;
    avatar?: string;
    skills?: string[];
  };
}

export class AgentStatusService {
  private redis: ReturnType<typeof createClient>;
  private readonly AGENT_PREFIX = 'agent:session:';
  private readonly STATUS_INDEX = 'agent:status:index';
  private readonly TENANT_INDEX_PREFIX = 'agent:tenant:';

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
      logger.info('Redis 坐席状态服务已连接');
    } catch (error) {
      logger.error('Redis 连接失败', { error });
    }
  }

  /**
   * 设置坐席状态
   */
  async setAgentStatus(
    agentId: string,
    tenantId: string,
    userId: string,
    status: AgentStatus,
    metadata?: AgentSession['metadata']
  ): Promise<AgentSession> {
    const session: AgentSession = {
      agentId,
      tenantId,
      userId,
      status,
      maxConcurrentSessions: 10, // 默认最大并发 10 个会话
      currentSessions: await this.getCurrentSessionCount(agentId),
      lastActiveAt: Date.now(),
      metadata,
    };

    const key = this.getAgentKey(agentId);
    await this.redis.set(key, JSON.stringify(session));

    // 更新状态索引
    await this.redis.sAdd(this.STATUS_INDEX, agentId);

    // 更新租户索引
    const tenantKey = this.getTenantKey(tenantId);
    await this.redis.sAdd(tenantKey, agentId);

    logger.info('坐席状态已更新', { agentId, status, tenantId });
    return session;
  }

  /**
   * 获取坐席状态
   */
  async getAgentStatus(agentId: string): Promise<AgentSession | null> {
    try {
      const key = this.getAgentKey(agentId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as AgentSession;
    } catch (error) {
      logger.error('获取坐席状态失败', { agentId, error });
      return null;
    }
  }

  /**
   * 获取租户下所有在线坐席
   */
  async getOnlineAgents(tenantId: string): Promise<AgentSession[]> {
    const agentIds = await this.getTenantAgents(tenantId);
    const onlineAgents: AgentSession[] = [];

    for (const agentId of agentIds) {
      const session = await this.getAgentStatus(agentId);
      if (session && session.status === 'online') {
        onlineAgents.push(session);
      }
    }

    return onlineAgents;
  }

  /**
   * 获取可用坐席（在线且有负载容量）
   */
  async getAvailableAgent(tenantId: string): Promise<AgentSession | null> {
    const onlineAgents = await this.getOnlineAgents(tenantId);
    
    // 过滤出有容量的坐席
    const availableAgents = onlineAgents.filter(
      agent => agent.currentSessions < agent.maxConcurrentSessions
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // 负载均衡：选择当前会话数最少的坐席
    availableAgents.sort((a, b) => a.currentSessions - b.currentSessions);
    return availableAgents[0];
  }

  /**
   * 增加坐席当前会话数
   */
  async incrementSessionCount(agentId: string): Promise<number> {
    const session = await this.getAgentStatus(agentId);
    if (!session) {
      throw new Error(`坐席不存在：${agentId}`);
    }

    session.currentSessions += 1;
    session.lastActiveAt = Date.now();

    await this.saveSession(session);
    return session.currentSessions;
  }

  /**
   * 减少坐席当前会话数
   */
  async decrementSessionCount(agentId: string): Promise<number> {
    const session = await this.getAgentStatus(agentId);
    if (!session) {
      throw new Error(`坐席不存在：${agentId}`);
    }

    session.currentSessions = Math.max(0, session.currentSessions - 1);
    session.lastActiveAt = Date.now();

    await this.saveSession(session);
    return session.currentSessions;
  }

  /**
   * 获取坐席当前会话数
   */
  async getCurrentSessionCount(agentId: string): Promise<number> {
    const session = await this.getAgentStatus(agentId);
    return session?.currentSessions || 0;
  }

  /**
   * 更新坐席最大并发会话数
   */
  async updateMaxConcurrentSessions(
    agentId: string,
    maxConcurrentSessions: number
  ): Promise<void> {
    const session = await this.getAgentStatus(agentId);
    if (!session) {
      throw new Error(`坐席不存在：${agentId}`);
    }

    session.maxConcurrentSessions = maxConcurrentSessions;
    await this.saveSession(session);
  }

  /**
   * 获取租户下所有坐席
   */
  async getAllAgents(tenantId: string): Promise<AgentSession[]> {
    const agentIds = await this.getTenantAgents(tenantId);
    const agents: AgentSession[] = [];

    for (const agentId of agentIds) {
      const session = await this.getAgentStatus(agentId);
      if (session) {
        agents.push(session);
      }
    }

    return agents;
  }

  /**
   * 下线坐席
   */
  async logoutAgent(agentId: string): Promise<void> {
    const session = await this.getAgentStatus(agentId);
    if (!session) {
      return;
    }

    // 更新状态为离线
    session.status = 'offline';
    session.lastActiveAt = Date.now();
    await this.saveSession(session);

    // 从在线索引移除（但保留在租户索引中）
    await this.redis.sRem(this.STATUS_INDEX, agentId);

    logger.info('坐席已下线', { agentId });
  }

  /**
   * 获取所有在线坐席 ID
   */
  async getAllOnlineAgentIds(): Promise<string[]> {
    return await this.redis.sMembers(this.STATUS_INDEX);
  }

  /**
   * 保存坐席会话
   */
  private async saveSession(session: AgentSession): Promise<void> {
    const key = this.getAgentKey(session.agentId);
    await this.redis.set(key, JSON.stringify(session));
  }

  /**
   * 获取租户下所有坐席 ID
   */
  private async getTenantAgents(tenantId: string): Promise<string[]> {
    const key = this.getTenantKey(tenantId);
    return await this.redis.sMembers(key);
  }

  private getAgentKey(agentId: string): string {
    return `${this.AGENT_PREFIX}${agentId}`;
  }

  private getTenantKey(tenantId: string): string {
    return `${this.TENANT_INDEX_PREFIX}${tenantId}`;
  }
}

// 单例
export const agentStatusService = new AgentStatusService();
