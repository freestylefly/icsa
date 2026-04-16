/**
 * 对话历史管理服务
 * 管理多轮对话历史存储（Redis，TTL=30min，最近 10 轮）
 */

import { createClient } from 'redis';
import { logger } from '../../utils/logger';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    sources?: SearchSource[];
    intent?: string;
    confidence?: number;
  };
}

export interface SearchSource {
  chunkId: string;
  content: string;
  documentName?: string;
  similarity: number;
}

export interface ConversationHistory {
  sessionId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export class HistoryManagerService {
  private redis: ReturnType<typeof createClient>;
  private readonly TTL_MS = 30 * 60 * 1000; // 30 分钟
  private readonly MAX_MESSAGES = 10; // 最近 10 轮
  private readonly KEY_PREFIX = 'conversation:';

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
      logger.info('Redis 历史管理器已连接');
    } catch (error) {
      logger.error('Redis 连接失败', { error });
    }
  }

  /**
   * 添加用户消息
   */
  async addUserMessage(
    sessionId: string,
    content: string,
    metadata?: Message['metadata']
  ): Promise<Message> {
    const message: Message = {
      id: this.generateMessageId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata,
    };

    await this.addMessage(sessionId, message);
    return message;
  }

  /**
   * 添加助手消息
   */
  async addAssistantMessage(
    sessionId: string,
    content: string,
    metadata?: Message['metadata']
  ): Promise<Message> {
    const message: Message = {
      id: this.generateMessageId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata,
    };

    await this.addMessage(sessionId, message);
    return message;
  }

  /**
   * 获取对话历史
   */
  async getHistory(sessionId: string): Promise<Message[]> {
    try {
      const key = this.getKey(sessionId);
      const messages = await this.redis.lRange(key, 0, -1);

      if (!messages || messages.length === 0) {
        return [];
      }

      return messages.map((msg) => JSON.parse(msg) as Message);
    } catch (error) {
      logger.error('获取对话历史失败', { sessionId, error });
      return [];
    }
  }

  /**
   * 获取最近 N 轮对话
   */
  async getRecentMessages(sessionId: string, limit: number = 10): Promise<Message[]> {
    const key = this.getKey(sessionId);
    const messages = await this.redis.lRange(key, 0, limit - 1);

    if (!messages || messages.length === 0) {
      return [];
    }

    return messages.map((msg) => JSON.parse(msg) as Message);
  }

  /**
   * 获取上下文（用于 LLM Prompt）
   * 返回最近 N 轮对话，格式化为文本
   */
  async getContextForPrompt(sessionId: string, rounds: number = 5): Promise<string> {
    const messages = await this.getRecentMessages(sessionId, rounds * 2);
    
    if (messages.length === 0) {
      return '';
    }

    return messages
      .map((msg) => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
      .join('\n');
  }

  /**
   * 清空对话历史
   */
  async clearHistory(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redis.del(key);
    logger.info('对话历史已清空', { sessionId });
  }

  /**
   * 添加消息到 Redis 列表（头部插入，保持最新在前）
   */
  private async addMessage(sessionId: string, message: Message): Promise<void> {
    const key = this.getKey(sessionId);
    const ttlSeconds = this.TTL_MS / 1000;

    // 从左侧推入（头部）
    await this.redis.lPush(key, JSON.stringify(message));

    // 限制消息数量
    await this.redis.lTrim(key, 0, this.MAX_MESSAGES * 2 - 1);

    // 设置 TTL
    await this.redis.expire(key, ttlSeconds);

    logger.debug('消息已保存', { sessionId, messageId: message.id });
  }

  private getKey(sessionId: string): string {
    return `${this.KEY_PREFIX}${sessionId}:messages`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 单例
export const historyManager = new HistoryManagerService();
