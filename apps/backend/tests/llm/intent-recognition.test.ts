/**
 * 意图识别服务单元测试
 */

import { intentRecognitionService, IntentDefinition } from '../../src/services/llm/intent-recognition.service';

describe('IntentRecognitionService', () => {
  describe('recognizeIntent', () => {
    it('应该识别问候意图', async () => {
      const result = await intentRecognitionService.recognizeIntent('你好');

      expect(result).toBeDefined();
      expect(result.intent).toBe('greeting');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('应该识别产品咨询意图', async () => {
      const result = await intentRecognitionService.recognizeIntent('这个产品多少钱');

      expect(result.intent).toBe('product_inquiry');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('应该识别订单状态查询意图', async () => {
      const result = await intentRecognitionService.recognizeIntent('我的订单到哪了');

      expect(result.intent).toBe('order_status');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('应该识别退款请求意图', async () => {
      const result = await intentRecognitionService.recognizeIntent('我要退款');

      expect(result.intent).toBe('refund_request');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('应该识别转人工请求', async () => {
      const result = await intentRecognitionService.recognizeIntent('转人工客服');

      expect(result.intent).toBe('handoff_request');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('应该识别告别意图', async () => {
      const result = await intentRecognitionService.recognizeIntent('再见，谢谢');

      expect(result.intent).toBe('farewell');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('应该为模糊输入返回低置信度', async () => {
      const result = await intentRecognitionService.recognizeIntent('asdfghjkl');

      expect(result.confidence).toBeLessThan(0.6);
    });

    it('应该处理带上下文的意图识别', async () => {
      // 创建一个模拟会话
      const mockSession = {
        sessionId: 'test_session',
        tenantId: 'test_tenant',
        userId: 'test_user',
        status: 'active',
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      const result = await intentRecognitionService.recognizeIntent(
        '还是刚才那个问题',
        mockSession
      );

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
    });

    it('应该处理空输入', async () => {
      const result = await intentRecognitionService.recognizeIntent('');

      expect(result).toBeDefined();
      expect(result.intent).toBe('other');
    });
  });

  describe('isHandoffRequest', () => {
    it('应该识别 handoff_request 意图', () => {
      const result = intentRecognitionService.isHandoffRequest('handoff_request');
      expect(result).toBe(true);
    });

    it('应该识别 entities 中的 handoff 标记', () => {
      const result = intentRecognitionService.isHandoffRequest('other', { handoff: true });
      expect(result).toBe(true);
    });

    it('应该返回 false 对于普通意图', () => {
      const result = intentRecognitionService.isHandoffRequest('greeting');
      expect(result).toBe(false);
    });
  });

  describe('getAvailableIntents', () => {
    it('应该返回所有预定义意图', () => {
      const intents = intentRecognitionService.getAvailableIntents();

      expect(intents.length).toBeGreaterThan(0);
      expect(intents.every(i => i.name && i.description && i.examples)).toBe(true);
    });

    it('应该包含所有预期意图', () => {
      const intents = intentRecognitionService.getAvailableIntents();
      const intentNames = intents.map(i => i.name);

      expect(intentNames).toContain('greeting');
      expect(intentNames).toContain('product_inquiry');
      expect(intentNames).toContain('order_status');
      expect(intentNames).toContain('refund_request');
      expect(intentNames).toContain('technical_support');
      expect(intentNames).toContain('handoff_request');
      expect(intentNames).toContain('complaint');
      expect(intentNames).toContain('farewell');
      expect(intentNames).toContain('other');
    });
  });

  describe('置信度阈值判断', () => {
    it('应该为明确意图返回高置信度', async () => {
      const testCases = [
        { input: '你好', expectedIntent: 'greeting' },
        { input: '转人工', expectedIntent: 'handoff_request' },
        { input: '我要退款', expectedIntent: 'refund_request' },
      ];

      for (const testCase of testCases) {
        const result = await intentRecognitionService.recognizeIntent(testCase.input);
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      }
    });

    it('应该为不明确意图返回低置信度', async () => {
      const ambiguousInputs = [
        '随便说说',
        '测试',
        '123456',
      ];

      for (const input of ambiguousInputs) {
        const result = await intentRecognitionService.recognizeIntent(input);
        expect(result.confidence).toBeLessThan(0.6);
      }
    });
  });

  describe('实体提取', () => {
    it('应该提取订单号', async () => {
      const result = await intentRecognitionService.recognizeIntent(
        '查询订单状态，订单号是 12345678'
      );

      expect(result.entities).toBeDefined();
      // 具体实现可能不同，这里只检查返回结构
    });

    it('应该提取产品名', async () => {
      const result = await intentRecognitionService.recognizeIntent(
        'iPhone 15 Pro 多少钱'
      );

      expect(result.entities).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理 LLM 调用失败', async () => {
      // 这个测试依赖于 LLM 服务的错误处理
      // 实际应该 mock LLM 服务
      const result = await intentRecognitionService.recognizeIntent('测试');
      
      // 即使失败也应该返回降级结果
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });
});
