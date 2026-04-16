/**
 * 数据分析模块集成测试
 * 测试对话统计、坐席绩效、满意度等功能
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('数据分析模块集成测试', () => {
  let authToken: string;
  let tenantId: string;
  let agentId: string;

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

  describe('对话统计', () => {
    it('应该能获取对话统计', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalConversations).toBeDefined();
      expect(response.body.data.resolutionRate).toBeDefined();
      expect(response.body.data.transferRate).toBeDefined();
    });

    it('应该能获取对话趋势（按日）', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/conversations/trend')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          granularity: 'day',
          days: 7,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dates).toBeDefined();
      expect(Array.isArray(response.body.data.dates)).toBe(true);
      expect(response.body.data.total).toBeDefined();
      expect(Array.isArray(response.body.data.total)).toBe(true);
    });

    it('应该能获取常见问题 TOP10', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/faq/top')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          limit: 10,
          days: 30,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该能获取响应时间统计', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/response-time')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          days: 30,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.avgResponseTime).toBeDefined();
      expect(response.body.data.p95ResponseTime).toBeDefined();
      expect(response.body.data.p99ResponseTime).toBeDefined();
    });
  });

  describe('坐席绩效', () => {
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    it('应该能获取坐席绩效', async () => {
      const response = await request(API_URL)
        .get(`/api/analytics/agents/${agentId}/performance`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          startDate,
          endDate,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agentId).toBe(agentId);
      expect(response.body.data.totalConversations).toBeDefined();
      expect(response.body.data.resolutionRate).toBeDefined();
    });

    it('应该能获取坐席排名', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/agents/ranking')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          startDate,
          endDate,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该能获取团队统计', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/agents/team-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          startDate,
          endDate,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalAgents).toBeDefined();
      expect(response.body.data.activeAgents).toBeDefined();
      expect(response.body.data.totalConversations).toBeDefined();
    });

    it('应该能获取坐席工作量', async () => {
      const response = await request(API_URL)
        .get(`/api/analytics/agents/${agentId}/workload`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          startDate,
          endDate,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('满意度统计', () => {
    it('应该能获取满意度统计', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/satisfaction')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.averageRating).toBeDefined();
      expect(response.body.data.totalRatings).toBeDefined();
      expect(response.body.data.ratingDistribution).toBeDefined();
    });

    it('应该能获取坐席满意度', async () => {
      const response = await request(API_URL)
        .get(`/api/analytics/agents/${agentId}/satisfaction`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.averageRating).toBeDefined();
      expect(response.body.data.totalRatings).toBeDefined();
    });

    it('应该能提交满意度评价', async () => {
      // 先创建一个测试对话
      const conversationResponse = await request(API_URL)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          agentId: 'test-agent',
          userId: 'test-user',
        });

      const conversationId = conversationResponse.body.data.id;

      const response = await request(API_URL)
        .post('/api/analytics/satisfaction/rating')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          conversationId,
          agentId,
          rating: 5,
          comment: '服务很好，解决问题很快',
          tags: ['响应快', '专业'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(5);
    });

    it('应该能获取最近的评价', async () => {
      const response = await request(API_URL)
        .get('/api/analytics/satisfaction/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .query({
          limit: 20,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
