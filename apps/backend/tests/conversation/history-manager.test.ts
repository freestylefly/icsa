/**
 * 历史管理器单元测试
 */

import { historyManager, Message } from '../../src/services/conversation/history-manager.service';

describe('HistoryManagerService', () => {
  const testSessionId = 'test_session_001';

  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // 清理测试数据
    const redis = (historyManager as any).redis;
    const keys = await redis.keys('conversation:*');
    for (const key of keys) {
      await redis.del(key);
    }
  });

  beforeEach(async () => {
    // 清空测试会话的历史
    await historyManager.clearHistory(testSessionId);
  });

  describe('addUserMessage', () => {
    it('应该添加用户消息', async () => {
      const message = await historyManager.addUserMessage(
        testSessionId,
        '你好，我想咨询产品价格'
      );

      expect(message).toBeDefined();
      expect(message.id).toMatch(/^msg_[\w_]+$/);
      expect(message.role).toBe('user');
      expect(message.content).toBe('你好，我想咨询产品价格');
      expect(message.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('应该带 metadata 添加用户消息', async () => {
      const metadata = { intent: 'product_inquiry', confidence: 0.95 };
      const message = await historyManager.addUserMessage(
        testSessionId,
        '产品价格',
        metadata
      );

      expect(message.metadata).toEqual(metadata);
    });
  });

  describe('addAssistantMessage', () => {
    it('应该添加助手消息', async () => {
      const message = await historyManager.addAssistantMessage(
        testSessionId,
        '我们的产品有多种定价方案，基础版每月 99 元...'
      );

      expect(message).toBeDefined();
      expect(message.id).toMatch(/^msg_[\w_]+$/);
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('我们的产品有多种定价方案，基础版每月 99 元...');
    });

    it('应该带 sources 添加助手消息', async () => {
      const sources = [
        {
          chunkId: 'chunk_001',
          content: '定价信息...',
          documentName: '产品手册.pdf',
          similarity: 0.92,
        },
      ];

      const message = await historyManager.addAssistantMessage(
        testSessionId,
        '根据产品手册...',
        { sources }
      );

      expect(message.metadata?.sources).toEqual(sources);
    });
  });

  describe('getHistory', () => {
    it('应该获取对话历史', async () => {
      await historyManager.addUserMessage(testSessionId, '消息 1');
      await historyManager.addAssistantMessage(testSessionId, '回复 1');
      await historyManager.addUserMessage(testSessionId, '消息 2');

      const history = await historyManager.getHistory(testSessionId);

      expect(history.length).toBe(3);
      expect(history[0].content).toBe('消息 2'); // 最新的在前
      expect(history[1].content).toBe('回复 1');
      expect(history[2].content).toBe('消息 1');
    });

    it('应该返回空数组对于不存在的会话', async () => {
      const history = await historyManager.getHistory('non_existent_session');
      expect(history).toEqual([]);
    });
  });

  describe('getRecentMessages', () => {
    it('应该获取最近 N 条消息', async () => {
      // 添加 10 条消息
      for (let i = 0; i < 5; i++) {
        await historyManager.addUserMessage(testSessionId, `用户消息${i}`);
        await historyManager.addAssistantMessage(testSessionId, `助手回复${i}`);
      }

      const recent = await historyManager.getRecentMessages(testSessionId, 5);

      expect(recent.length).toBe(5);
      expect(recent[0].content).toBe('助手回复 4'); // 最新的在前
    });

    it('应该限制返回数量', async () => {
      for (let i = 0; i < 10; i++) {
        await historyManager.addUserMessage(testSessionId, `消息${i}`);
      }

      const recent = await historyManager.getRecentMessages(testSessionId, 3);
      expect(recent.length).toBe(3);
    });
  });

  describe('getContextForPrompt', () => {
    it('应该格式化对话上下文', async () => {
      await historyManager.addUserMessage(testSessionId, '你好');
      await historyManager.addAssistantMessage(testSessionId, '您好！有什么可以帮助您？');
      await historyManager.addUserMessage(testSessionId, '产品价格');

      const context = await historyManager.getContextForPrompt(testSessionId, 5);

      expect(context).toContain('用户：你好');
      expect(context).toContain('助手：您好！有什么可以帮助您？');
      expect(context).toContain('用户：产品价格');
    });

    it('应该限制轮数', async () => {
      for (let i = 0; i < 10; i++) {
        await historyManager.addUserMessage(testSessionId, `消息${i}`);
        await historyManager.addAssistantMessage(testSessionId, `回复${i}`);
      }

      const context = await historyManager.getContextForPrompt(testSessionId, 2);
      const lines = context.split('\n');

      // 最近 2 轮 = 4 条消息
      expect(lines.length).toBeLessThanOrEqual(4);
    });

    it('应该返回空字符串对于空历史', async () => {
      const context = await historyManager.getContextForPrompt('empty_session');
      expect(context).toBe('');
    });
  });

  describe('clearHistory', () => {
    it('应该清空对话历史', async () => {
      await historyManager.addUserMessage(testSessionId, '消息 1');
      await historyManager.addAssistantMessage(testSessionId, '回复 1');

      await historyManager.clearHistory(testSessionId);

      const history = await historyManager.getHistory(testSessionId);
      expect(history).toEqual([]);
    });
  });

  describe('消息限制', () => {
    it('应该限制最多保存 10 轮消息（20 条）', async () => {
      // 添加 25 条消息
      for (let i = 0; i < 25; i++) {
        await historyManager.addUserMessage(testSessionId, `消息${i}`);
      }

      const history = await historyManager.getHistory(testSessionId);
      
      // 应该最多保留 20 条（10 轮）
      expect(history.length).toBeLessThanOrEqual(20);
    });
  });

  describe('TTL', () => {
    it('应该设置正确的 TTL（30 分钟）', async () => {
      await historyManager.addUserMessage(testSessionId, '测试消息');
      
      const redis = (historyManager as any).redis;
      const key = `conversation:${testSessionId}:messages`;
      
      const ttl = await redis.ttl(key);
      
      // TTL 应该在 1790-1800 秒之间
      expect(ttl).toBeGreaterThanOrEqual(1790);
      expect(ttl).toBeLessThanOrEqual(1800);
    });
  });

  describe('消息顺序', () => {
    it('应该保持最新消息在前', async () => {
      await historyManager.addUserMessage(testSessionId, '第一条');
      await new Promise(resolve => setTimeout(resolve, 10));
      await historyManager.addUserMessage(testSessionId, '第二条');
      await new Promise(resolve => setTimeout(resolve, 10));
      await historyManager.addUserMessage(testSessionId, '第三条');

      const history = await historyManager.getHistory(testSessionId);

      expect(history[0].content).toBe('第三条');
      expect(history[1].content).toBe('第二条');
      expect(history[2].content).toBe('第一条');
    });
  });
});
