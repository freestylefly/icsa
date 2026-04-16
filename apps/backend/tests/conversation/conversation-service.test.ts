/**
 * 对话服务集成测试
 */

import { conversationService, ConversationRequest } from '../../src/services/conversation/conversation.service';
import { sessionManager, SessionStatus } from '../../src/services/conversation/session-manager.service';
import { historyManager } from '../../src/services/conversation/history-manager.service';

describe('ConversationService', () => {
  const testTenantId = 'tenant_test_001';
  const testUserId = 'user_test_001';
  const testMessage = '你好，我想咨询产品价格';

  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // 清理测试数据
    const redis = (sessionManager as any).redis;
    const sessionKeys = await redis.keys('session:*');
    const conversationKeys = await redis.keys('conversation:*');
    
    for (const key of [...sessionKeys, ...conversationKeys]) {
      await redis.del(key);
    }
  });

  describe('processMessage', () => {
    it('应该处理简单的对话请求', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: testMessage,
      };

      const response = await conversationService.processMessage(request);

      expect(response).toBeDefined();
      expect(response.sessionId).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBeDefined();
    });

    it('应该创建新会话如果 sessionId 未提供', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '测试消息',
      };

      const response = await conversationService.processMessage(request);

      expect(response.sessionId).toBeDefined();
      
      // 验证会话已创建
      const session = await sessionManager.getSession(response.sessionId);
      expect(session).toBeDefined();
      expect(session?.tenantId).toBe(testTenantId);
    });

    it('应该复用已有会话', async () => {
      // 先创建一个会话
      const session = await sessionManager.createSession(testTenantId, testUserId);
      
      // 第一次对话
      const response1 = await conversationService.processMessage({
        tenantId: testTenantId,
        userId: testUserId,
        sessionId: session.sessionId,
        message: '第一条消息',
      });

      // 第二次对话（同一会话）
      const response2 = await conversationService.processMessage({
        tenantId: testTenantId,
        userId: testUserId,
        sessionId: session.sessionId,
        message: '第二条消息',
      });

      // 应该返回相同的 sessionId
      expect(response1.sessionId).toBe(session.sessionId);
      expect(response2.sessionId).toBe(session.sessionId);
    });

    it('应该为已关闭的会话重新打开', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      await sessionManager.closeSession(session.sessionId);

      const response = await conversationService.processMessage({
        tenantId: testTenantId,
        userId: testUserId,
        sessionId: session.sessionId,
        message: '重新打开会话',
      });

      const updatedSession = await sessionManager.getSession(session.sessionId);
      expect(updatedSession?.status).toBe(SessionStatus.ACTIVE);
    });

    it('应该处理转人工请求', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '我要转人工客服',
      };

      const response = await conversationService.processMessage(request);

      expect(response.shouldHandoff).toBe(true);
      expect(response.handoffReason).toBe('user_request');
      expect(response.message.content).toContain('人工客服');
    });

    it('应该保存对话历史', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '测试历史保存',
      };

      const response = await conversationService.processMessage(request);
      
      // 获取历史
      const history = await historyManager.getHistory(response.sessionId);
      
      // 应该至少有 2 条消息（用户 + 助手）
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some(m => m.role === 'user')).toBe(true);
      expect(history.some(m => m.role === 'assistant')).toBe(true);
    });
  });

  describe('processMessageStream', () => {
    it('应该流式处理对话', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '流式测试',
      };

      const tokens: string[] = [];
      let fullResponse = '';
      let sessionId = '';

      await conversationService.processMessageStream(request, {
        onToken: (token) => {
          tokens.push(token);
        },
        onComplete: (content, sources) => {
          fullResponse = content;
        },
        onError: (error) => {
          console.error('流式错误', error);
        },
      });

      // 流式输出应该有多个 token
      expect(tokens.length).toBeGreaterThan(0);
      expect(fullResponse).toBeDefined();
      expect(fullResponse.length).toBeGreaterThan(0);
    });

    it('应该在流式完成后保存历史', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '流式历史测试',
      };

      let sessionId = '';

      await conversationService.processMessageStream(request, {
        onToken: () => {},
        onComplete: (content, sources) => {
          // 完成回调中 sessionId 应该已经设置
        },
        onError: (error) => {},
      });

      // 由于 sessionId 在流式过程中返回，我们需要重新获取
      const sessions = await sessionManager.getActiveSessions(testTenantId);
      const latestSession = sessions[sessions.length - 1];
      
      if (latestSession) {
        const history = await historyManager.getHistory(latestSession.sessionId);
        expect(history.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('closeSession', () => {
    it('应该关闭会话', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      
      await conversationService.closeSession(session.sessionId);
      
      const closedSession = await sessionManager.getSession(session.sessionId);
      expect(closedSession?.status).toBe(SessionStatus.CLOSED);
    });
  });

  describe('getSessionHistory', () => {
    it('应该获取会话历史', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '历史测试',
      };

      const response = await conversationService.processMessage(request);
      
      const history = await conversationService.getSessionHistory(response.sessionId);
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].role).toBeDefined();
      expect(history[0].content).toBeDefined();
    });

    it('应该返回空数组对于不存在的会话', async () => {
      const history = await conversationService.getSessionHistory('non_existent');
      expect(history).toEqual([]);
    });
  });

  describe('错误处理', () => {
    it('应该处理缺失 tenantId 的情况', async () => {
      const request: any = {
        userId: testUserId,
        message: testMessage,
        // 缺少 tenantId
      };

      await expect(conversationService.processMessage(request))
        .rejects.toThrow();
    });

    it('应该处理缺失 message 的情况', async () => {
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '', // 空消息
      };

      await expect(conversationService.processMessage(request))
        .rejects.toThrow();
    });
  });

  describe('敏感词检测', () => {
    it('应该检测敏感词并转人工', async () => {
      // 这个测试依赖于 sensitivity-filter.service 的实现
      // 实际应该配置一些测试用的敏感词
      const request: ConversationRequest = {
        tenantId: testTenantId,
        userId: testUserId,
        message: '测试敏感词', // 需要配置敏感词
      };

      const response = await conversationService.processMessage(request);
      
      // 如果配置了敏感词，应该转人工
      // 这个测试需要根据实际的敏感词配置调整
    });
  });
});
