/**
 * 转人工队列管理服务
 * 管理坐席状态、负载均衡、自动分配
 */

import { createClient } from 'redis';
import { logger } from '../../utils/logger';
import { handoffService, HandoffTicket } from './handoff.service';

export interface AgentStatus {
  agentId: string;
  tenantId: string;
  status: 'online' | 'busy' | 'offline' | 'break';
  currentLoad: number; // 当前处理中的工单数
  maxLoad: number; // 最大并发工单数
  lastHeartbeat: number;
  skills?: string[]; // 客服技能标签
}

export interface AssignmentStrategy {
  type: 'round_robin' | 'least_load' | 'skill_based' | 'priority';
}

export class QueueManagerService {
  private redis: ReturnType<typeof createClient>;
  private readonly AGENT_PREFIX = 'agent:';
  private readonly AGENT_STATUS_KEY = 'agent:status';
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 秒

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.redis.on('error', (err) => {
      logger.error('Redis 连接错误', { error: err });
    });

    this.connect();
    this.startAutoAssignment();
  }

  private async connect() {
    try {
      await this.redis.connect();
      logger.info('Redis 队列管理器已连接');
    } catch (error) {
      logger.error('Redis 连接失败', { error });
    }
  }

  /**
   * 注册坐席
   */
  async registerAgent(agent: AgentStatus): Promise<void> {
    const key = this.getAgentKey(agent.agentId);
    await this.redis.set(key, JSON.stringify(agent));
    
    // 添加到在线坐席集合
    await this.redis.sAdd(this.AGENT_STATUS_KEY, agent.agentId);
    
    logger.info('坐席已注册', { agentId: agent.agentId, status: agent.status });
  }

  /**
   * 更新坐席状态
   */
  async updateAgentStatus(
    agentId: string,
    status: AgentStatus['status'],
    currentLoad?: number
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`坐席不存在：${agentId}`);
    }

    agent.status = status;
    agent.lastHeartbeat = Date.now();
    if (currentLoad !== undefined) {
      agent.currentLoad = currentLoad;
    }

    await this.registerAgent(agent);
    logger.debug('坐席状态已更新', { agentId, status });
  }

  /**
   * 坐席心跳
   */
  async heartbeat(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      await this.registerAgent(agent);
    }
  }

  /**
   * 注销坐席
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const key = this.getAgentKey(agentId);
    await this.redis.del(key);
    await this.redis.sRem(this.AGENT_STATUS_KEY, agentId);
    logger.info('坐席已注销', { agentId });
  }

  /**
   * 获取在线坐席列表
   */
  async getOnlineAgents(tenantId?: string): Promise<AgentStatus[]> {
    const agentIds = await this.redis.sMembers(this.AGENT_STATUS_KEY);
    const agents: AgentStatus[] = [];

    for (const agentId of agentIds) {
      const agent = await this.getAgent(agentId);
      if (agent && agent.status === 'online' && agent.currentLoad < agent.maxLoad) {
        if (!tenantId || agent.tenantId === tenantId) {
          agents.push(agent);
        }
      }
    }

    return agents;
  }

  /**
   * 自动分配工单
   */
  async autoAssign(strategy: AssignmentStrategy = { type: 'least_load' }): Promise<void> {
    const queueSize = await handoffService.getQueueSize();
    if (queueSize === 0) {
      return;
    }

    // 获取待分配工单
    const ticket = await handoffService.getNextPendingTicket();
    if (!ticket) {
      return;
    }

    // 根据策略选择坐席
    const availableAgents = await this.getOnlineAgents(ticket.tenantId);
    if (availableAgents.length === 0) {
      logger.warn('无可用坐席', { ticketId: ticket.id });
      return;
    }

    let selectedAgent: AgentStatus;

    switch (strategy.type) {
      case 'round_robin':
        selectedAgent = availableAgents[0]; // 简化实现
        break;
      case 'least_load':
        selectedAgent = availableAgents.reduce((min, agent) => 
          agent.currentLoad < min.currentLoad ? agent : min
        );
        break;
      case 'skill_based':
        // TODO: 根据技能匹配
        selectedAgent = availableAgents[0];
        break;
      case 'priority':
        selectedAgent = availableAgents[0];
        break;
      default:
        selectedAgent = availableAgents[0];
    }

    // 分配工单
    await handoffService.assignTicket(ticket.id, selectedAgent.agentId);
    logger.info('工单自动分配', { ticketId: ticket.id, agentId: selectedAgent.agentId });
  }

  /**
   * 启动自动分配（定时任务）
   */
  private startAutoAssignment() {
    setInterval(async () => {
      try {
        await this.autoAssign({ type: 'least_load' });
      } catch (error) {
        logger.error('自动分配失败', { error });
      }
    }, 5000); // 每 5 秒检查一次

    logger.info('自动分配任务已启动');
  }

  /**
   * 清理离线坐席
   */
  async cleanupOfflineAgents(): Promise<number> {
    const agentIds = await this.redis.sMembers(this.AGENT_STATUS_KEY);
    const now = Date.now();
    let cleanedCount = 0;

    for (const agentId of agentIds) {
      const agent = await this.getAgent(agentId);
      if (agent) {
        const timeSinceHeartbeat = now - agent.lastHeartbeat;
        if (timeSinceHeartbeat > this.HEARTBEAT_INTERVAL_MS * 3) {
          // 超过 3 倍心跳时间未更新，视为离线
          await this.unregisterAgent(agentId);
          cleanedCount++;
          logger.info('清理离线坐席', { agentId, lastHeartbeat: agent.lastHeartbeat });
        }
      }
    }

    return cleanedCount;
  }

  /**
   * 获取坐席统计信息
   */
  async getAgentStats(tenantId: string): Promise<{
    totalAgents: number;
    onlineAgents: number;
    busyAgents: number;
    totalLoad: number;
    avgLoad: number;
  }> {
    const agents = await this.getOnlineAgents(tenantId);
    const allAgents = await this.getAllAgents(tenantId);

    const onlineCount = agents.filter(a => a.status === 'online').length;
    const busyCount = agents.filter(a => a.status === 'busy').length;
    const totalLoad = agents.reduce((sum, a) => sum + a.currentLoad, 0);

    return {
      totalAgents: allAgents.length,
      onlineAgents: onlineCount,
      busyAgents: busyCount,
      totalLoad,
      avgLoad: onlineCount > 0 ? totalLoad / onlineCount : 0,
    };
  }

  private async getAgent(agentId: string): Promise<AgentStatus | null> {
    try {
      const key = this.getAgentKey(agentId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as AgentStatus;
    } catch (error) {
      logger.error('获取坐席失败', { agentId, error });
      return null;
    }
  }

  private async getAllAgents(tenantId?: string): Promise<AgentStatus[]> {
    const agentIds = await this.redis.sMembers(this.AGENT_STATUS_KEY);
    const agents: AgentStatus[] = [];

    for (const agentId of agentIds) {
      const agent = await this.getAgent(agentId);
      if (agent && (!tenantId || agent.tenantId === tenantId)) {
        agents.push(agent);
      }
    }

    return agents;
  }

  private getAgentKey(agentId: string): string {
    return `${this.AGENT_PREFIX}${agentId}`;
  }
}

// 单例
export const queueManager = new QueueManagerService();
