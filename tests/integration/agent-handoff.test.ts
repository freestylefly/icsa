/**
 * 人工协作模块集成测试
 * 测试坐席管理、会话分配、对话摘要等功能
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('人工协作模块集成测试', () => {
  let authToken: string;
  let tenantId: string;
  let agentId: string;
  let conversationId: string;

  beforeAll(async () => {
    // 登录获取 token
    const loginResponse = await request(API_URL)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'test123456',
      });

    authToken = loginResponse.body.data.token;
    tenantId = loginResponse.body.data.tenantId;

    // 创建测试 Agent
    const agentResponse = await request(API_URL)
      .post('/api/agents')
      .set('Authorization', `Bearer ${authToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: '测试坐席',
        description: '集成测试用坐席',
      });

    agentId = agentResponse.body.data.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (agentId) {
      await request(API_URL)
        .delete(`/api/agents/${agentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);
    }
  });

  describe('坐席状态管理', () => {
    it('应该能设置坐席状态为在线', async () => {
      const response = await request(API_URL)
        .put(`/api/agents/${agentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          status: 'online',
          metadata: {
            nickname: '测试坐席',
            skills: ['技术支持', '产品咨询'],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('online');
      expect(response.body.data.currentSessions).toBe(0);
    });

    it('应该能获取坐席状态', async () => {
      const response = await request(API_URL)
        .get(`/api/agents/${agentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.data.agentId).toBe(agentId);
      expect(response.body.data.status).toBe('online');
    });

    it('应该能获取租户下所有坐席', async () => {
      const response = await request(API_URL)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该能切换坐席状态为忙碌', async () => {
      const response = await request(API_URL)
        .put(`/api/agents/${agentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'busy' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('busy');
    });
  });

  describe('会话分配', () => {
    beforeAll(async () => {
      // 先设置坐席为在线状态
      await request(API_URL)
        .put(`/api/agents/${agentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'online' });
    });

    it('应该能分配会话给坐席（负载均衡策略）', async () => {
      // 创建一个测试对话
      const conversationResponse = await request(API_URL)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          agentId: 'test-agent',
          userId: 'test-user',
        });

      conversationId = conversationResponse.body.data.id;

      const response = await request(API_URL)
        .post('/api/agents/sessions/distribute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          conversationId,
          strategy: 'load_balance',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.conversationId).toBe(conversationId);
      expect(response.body.data.agentId).toBe(agentId);
    });

    it('坐席应该能接受会话', async () => {
      // 先获取分配记录
      const sessionsResponse = await request(API_URL)
        .get(`/api/agents/${agentId}/sessions`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      const distributionId = sessionsResponse.body.data[0]?.id;

      if (distributionId) {
        const response = await request(API_URL)
          .post(`/api/agents/sessions/${distributionId}/accept`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('x-tenant-id', tenantId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('应该能完成会话', async () => {
      const response = await request(API_URL)
        .post(`/api/agents/sessions/${conversationId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('对话摘要生成', () => {
    it('应该能生成对话摘要', async () => {
      const response = await request(API_URL)
        .post(`/api/agents/sessions/${conversationId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.keyPoints).toBeDefined();
      expect(Array.isArray(response.body.data.keyPoints)).toBe(true);
    });
  });

  describe('等待队列', () => {
    it('应该能获取等待队列中的会话', async () => {
      const response = await request(API_URL)
        .get('/api/agents/sessions/pending')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
