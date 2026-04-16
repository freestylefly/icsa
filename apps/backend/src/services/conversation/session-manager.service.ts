/**
 * 会话状态管理服务
 * 管理会话的创建、销毁、状态转换（active/closed/transferred）
 */

import { createClient } from 'redis';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export enum SessionStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  TRANSFERRED = 'transferred',
}

export interface SessionData {
  sessionId: string;
  tenantId: string;
  userId?: string;
  agentId?: string;
  status: SessionStatus;
  createdAt: number;
  lastActivityAt: number;
  metadata?: Record<string, any>;
}

export class SessionManagerService {
  private redis: ReturnType<typeof createClient>;
  private readonly TTL_MS = 30 * 60 * 1000; // 30 分钟
  private readonly KEY_PREFIX = 'session:';

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
      logger.info('Redis 会话管理器已连接');
    } catch (error) {
      logger.error('Redis 连接失败', { error });
    }
  }

  /**
   * 创建新会话
   */
  async createSession(
    tenantId: string,
    userId?: string,
    agentId?: string,
    metadata?: Record<string, any>
  ): Promise<SessionData> {
    const sessionId = uuidv4();
    const now = Date.now();

    const session: SessionData = {
      sessionId,
      tenantId,
      userId,
      agentId,
      status: SessionStatus.ACTIVE,
      createdAt: now,
      lastActivityAt: now,
      metadata,
    };

    await this.saveSession(session);
    logger.info('会话创建成功', { sessionId, tenantId, userId });

    return session;
  }

  /**
   * 获取会话
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const key = this.getKey(sessionId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as SessionData;
    } catch (error) {
      logger.error('获取会话失败', { sessionId, error });
      return null;
    }
  }

  /**
   * 更新会话最后活动时间
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      await this.saveSession(session);
    }
  }

  /**
   * 更新会话状态
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在：${sessionId}`);
    }

    session.status = status;
    if (metadata) {
      session.metadata = { ...session.metadata, ...metadata };
    }

    await this.saveSession(session);
    logger.info('会话状态更新', { sessionId, status });
  }

  /**
   * 关闭会话
   */
  async closeSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, SessionStatus.CLOSED);
  }

  /**
   * 转人工会话
   */
  async transferToHuman(
    sessionId: string,
    agentId: string,
    reason?: string
  ): Promise<void> {
    await this.updateSessionStatus(sessionId, SessionStatus.TRANSFERRED, {
      transferredAt: Date.now(),
      transferReason: reason,
      agentId,
    });
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redis.del(key);
    logger.info('会话已删除', { sessionId });
  }

  /**
   * 获取租户下所有活跃会话
   */
  async getActiveSessions(tenantId: string): Promise<SessionData[]> {
    const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
    const sessions: SessionData[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data) as SessionData;
        if (session.tenantId === tenantId && session.status === SessionStatus.ACTIVE) {
          sessions.push(session);
        }
      }
    }

    return sessions;
  }

  /**
   * 保存会话到 Redis（带 TTL）
   */
  private async saveSession(session: SessionData): Promise<void> {
    const key = this.getKey(session.sessionId);
    const ttlSeconds = this.TTL_MS / 1000;

    await this.redis.set(key, JSON.stringify(session), {
      EX: ttlSeconds,
    });
  }

  private getKey(sessionId: string): string {
    return `${this.KEY_PREFIX}${sessionId}`;
  }

  /**
   * 清理过期会话（定时任务调用）
   */
  async cleanupExpiredSessions(): Promise<number> {
    // Redis 会自动处理 TTL，此方法用于手动清理或统计
    const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
    let cleanedCount = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) {
        await this.redis.del(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('清理过期会话', { count: cleanedCount });
    }

    return cleanedCount;
  }
}

// 单例
export const sessionManager = new SessionManagerService();
