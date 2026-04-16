/**
 * 会话管理器单元测试
 */

import { sessionManager, SessionStatus } from '../../src/services/conversation/session-manager.service';

describe('SessionManagerService', () => {
  const testTenantId = 'tenant_test_001';
  const testUserId = 'user_test_001';
  const testAgentId = 'agent_test_001';

  beforeAll(async () => {
    // 等待 Redis 连接
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // 清理测试数据
    const redis = (sessionManager as any).redis;
    const keys = await redis.keys('session:*');
    for (const key of keys) {
      await redis.del(key);
    }
  });

  describe('createSession', () => {
    it('应该成功创建新会话', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId, testAgentId);

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^[\w-]+$/);
      expect(session.tenantId).toBe(testTenantId);
      expect(session.userId).toBe(testUserId);
      expect(session.agentId).toBe(testAgentId);
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(session.lastActivityAt).toBeLessThanOrEqual(Date.now());
    });

    it('应该创建不带 userId 和 agentId 的会话', async () => {
      const session = await sessionManager.createSession(testTenantId);

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^[\w-]+$/);
      expect(session.tenantId).toBe(testTenantId);
      expect(session.userId).toBeUndefined();
      expect(session.agentId).toBeUndefined();
      expect(session.status).toBe(SessionStatus.ACTIVE);
    });

    it('应该带 metadata 创建会话', async () => {
      const metadata = { source: 'web', campaign: 'test' };
      const session = await sessionManager.createSession(
        testTenantId,
        testUserId,
        undefined,
        metadata
      );

      expect(session.metadata).toEqual(metadata);
    });
  });

  describe('getSession', () => {
    it('应该获取已存在的会话', async () => {
      const created = await sessionManager.createSession(testTenantId, testUserId);
      const retrieved = await sessionManager.getSession(created.sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
      expect(retrieved?.tenantId).toBe(testTenantId);
    });

    it('应该返回 null 对于不存在的会话', async () => {
      const retrieved = await sessionManager.getSession('non_existent_id');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSessionStatus', () => {
    it('应该更新会话状态为 closed', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      await sessionManager.updateSessionStatus(session.sessionId, SessionStatus.CLOSED);

      const updated = await sessionManager.getSession(session.sessionId);
      expect(updated?.status).toBe(SessionStatus.CLOSED);
    });

    it('应该更新会话状态为 transferred', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      await sessionManager.updateSessionStatus(session.sessionId, SessionStatus.TRANSFERRED);

      const updated = await sessionManager.getSession(session.sessionId);
      expect(updated?.status).toBe(SessionStatus.TRANSFERRED);
    });

    it('应该抛出错误对于不存在的会话', async () => {
      await expect(
        sessionManager.updateSessionStatus('non_existent', SessionStatus.CLOSED)
      ).rejects.toThrow('会话不存在');
    });
  });

  describe('closeSession', () => {
    it('应该关闭会话', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      await sessionManager.closeSession(session.sessionId);

      const updated = await sessionManager.getSession(session.sessionId);
      expect(updated?.status).toBe(SessionStatus.CLOSED);
    });
  });

  describe('transferToHuman', () => {
    it('应该转人工会话', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      await sessionManager.transferToHuman(session.sessionId, testAgentId, '用户请求');

      const updated = await sessionManager.getSession(session.sessionId);
      expect(updated?.status).toBe(SessionStatus.TRANSFERRED);
      expect(updated?.metadata?.agentId).toBe(testAgentId);
      expect(updated?.metadata?.transferReason).toBe('用户请求');
    });
  });

  describe('updateLastActivity', () => {
    it('应该更新最后活动时间', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      const initialActivity = session.lastActivityAt;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionManager.updateLastActivity(session.sessionId);

      const updated = await sessionManager.getSession(session.sessionId);
      expect(updated?.lastActivityAt).toBeGreaterThan(initialActivity);
    });
  });

  describe('deleteSession', () => {
    it('应该删除会话', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      await sessionManager.deleteSession(session.sessionId);

      const retrieved = await sessionManager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('getActiveSessions', () => {
    it('应该获取租户下所有活跃会话', async () => {
      // 创建多个会话
      const session1 = await sessionManager.createSession(testTenantId, testUserId);
      const session2 = await sessionManager.createSession(testTenantId, testUserId);
      
      // 关闭一个
      await sessionManager.closeSession(session1.sessionId);

      const activeSessions = await sessionManager.getActiveSessions(testTenantId);
      
      expect(activeSessions.length).toBeGreaterThanOrEqual(1);
      expect(activeSessions.every(s => s.status === SessionStatus.ACTIVE)).toBe(true);
      expect(activeSessions.every(s => s.tenantId === testTenantId)).toBe(true);
    });
  });

  describe('TTL', () => {
    it('应该设置正确的 TTL（30 分钟）', async () => {
      const session = await sessionManager.createSession(testTenantId, testUserId);
      const redis = (sessionManager as any).redis;
      const key = `session:${session.sessionId}`;
      
      const ttl = await redis.ttl(key);
      
      // TTL 应该在 1790-1800 秒之间（30 分钟）
      expect(ttl).toBeGreaterThanOrEqual(1790);
      expect(ttl).toBeLessThanOrEqual(1800);
    });
  });
});
