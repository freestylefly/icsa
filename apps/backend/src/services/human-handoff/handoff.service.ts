/**
 * 转人工服务
 * 管理转人工请求、队列、分配
 */

import { createClient } from 'redis';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export type HandoffReason = 
  | 'low_confidence'      // 低置信度
  | 'sensitive_content'   // 敏感内容
  | 'user_request'        // 用户主动请求
  | 'already_transferred' // 已转人工
  | 'escalation';         // 升级处理

export interface HandoffRequest {
  sessionId: string;
  tenantId: string;
  userId?: string;
  reason: HandoffReason;
  reasonDetail?: string;
  priority?: number; // 1-10，数字越大优先级越高
}

export interface HandoffTicket {
  id: string;
  sessionId: string;
  tenantId: string;
  userId?: string;
  agentId?: string; // 分配的人工客服 ID
  status: HandoffStatus;
  reason: HandoffReason;
  reasonDetail?: string;
  priority: number;
  createdAt: number;
  assignedAt?: number;
  acceptedAt?: number;
  closedAt?: number;
}

export type HandoffStatus = 
  | 'pending'     // 等待分配
  | 'assigned'    // 已分配
  | 'accepted'    // 已接受
  | 'closed';     // 已关闭

export class HandoffService {
  private redis: ReturnType<typeof createClient>;
  private readonly QUEUE_KEY = 'handoff:queue';
  private readonly TICKET_PREFIX = 'handoff:ticket:';

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
      logger.info('Redis 转人工服务已连接');
    } catch (error) {
      logger.error('Redis 连接失败', { error });
    }
  }

  /**
   * 创建转人工请求
   */
  async createHandoff(request: HandoffRequest): Promise<HandoffTicket> {
    const ticketId = uuidv4();
    const now = Date.now();

    const ticket: HandoffTicket = {
      id: ticketId,
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      userId: request.userId,
      status: 'pending',
      reason: request.reason,
      reasonDetail: request.reasonDetail,
      priority: request.priority || 5,
      createdAt: now,
    };

    // 保存工单
    await this.saveTicket(ticket);

    // 加入队列（按优先级排序）
    await this.addToQueue(ticketId, ticket.priority);

    logger.info('转人工请求已创建', {
      ticketId,
      sessionId: request.sessionId,
      reason: request.reason,
    });

    return ticket;
  }

  /**
   * 获取工单
   */
  async getTicket(ticketId: string): Promise<HandoffTicket | null> {
    try {
      const key = this.getTicketKey(ticketId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as HandoffTicket;
    } catch (error) {
      logger.error('获取工单失败', { ticketId, error });
      return null;
    }
  }

  /**
   * 分配工单给客服
   */
  async assignTicket(ticketId: string, agentId: string): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`工单不存在：${ticketId}`);
    }

    ticket.agentId = agentId;
    ticket.status = 'assigned';
    ticket.assignedAt = Date.now();

    await this.saveTicket(ticket);
    await this.removeFromQueue(ticketId);

    logger.info('工单已分配', { ticketId, agentId });
  }

  /**
   * 客服接受工单
   */
  async acceptTicket(ticketId: string): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`工单不存在：${ticketId}`);
    }

    ticket.status = 'accepted';
    ticket.acceptedAt = Date.now();

    await this.saveTicket(ticket);
    logger.info('工单已接受', { ticketId });
  }

  /**
   * 关闭工单
   */
  async closeTicket(ticketId: string): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`工单不存在：${ticketId}`);
    }

    ticket.status = 'closed';
    ticket.closedAt = Date.now();

    await this.saveTicket(ticket);
    logger.info('工单已关闭', { ticketId });
  }

  /**
   * 从队列中获取下一个待分配工单（优先级最高）
   */
  async getNextPendingTicket(): Promise<HandoffTicket | null> {
    // 从有序集合中获取优先级最高的工单 ID
    const ticketIds = await this.redis.zRevRange(this.QUEUE_KEY, 0, 0);
    
    if (ticketIds.length === 0) {
      return null;
    }

    const ticketId = ticketIds[0];
    return await this.getTicket(ticketId);
  }

  /**
   * 获取队列中的工单数量
   */
  async getQueueSize(): Promise<number> {
    return await this.redis.zCard(this.QUEUE_KEY);
  }

  /**
   * 获取租户下所有待处理工单
   */
  async getPendingTicketsForTenant(tenantId: string): Promise<HandoffTicket[]> {
    const ticketIds = await this.redis.zRevRange(this.QUEUE_KEY, 0, -1);
    const tickets: HandoffTicket[] = [];

    for (const ticketId of ticketIds) {
      const ticket = await this.getTicket(ticketId);
      if (ticket && ticket.tenantId === tenantId) {
        tickets.push(ticket);
      }
    }

    return tickets;
  }

  /**
   * 获取客服的工单列表
   */
  async getTicketsForAgent(agentId: string, status?: HandoffStatus): Promise<HandoffTicket[]> {
    // 实际实现需要维护 agent -> tickets 的索引
    // 这里简化处理
    logger.debug('获取客服工单', { agentId, status });
    return [];
  }

  /**
   * 保存工单到 Redis
   */
  private async saveTicket(ticket: HandoffTicket): Promise<void> {
    const key = this.getTicketKey(ticket.id);
    await this.redis.set(key, JSON.stringify(ticket));
  }

  /**
   * 添加工单到队列（有序集合，按优先级排序）
   */
  private async addToQueue(ticketId: string, priority: number): Promise<void> {
    await this.redis.zAdd(this.QUEUE_KEY, {
      score: priority,
      value: ticketId,
    });
  }

  /**
   * 从队列移除工单
   */
  private async removeFromQueue(ticketId: string): Promise<void> {
    await this.redis.zRem(this.QUEUE_KEY, ticketId);
  }

  private getTicketKey(ticketId: string): string {
    return `${this.TICKET_PREFIX}${ticketId}`;
  }
}

// 单例
export const handoffService = new HandoffService();
