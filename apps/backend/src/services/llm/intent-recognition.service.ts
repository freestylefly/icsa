/**
 * 意图识别服务
 * 使用 Prompt 模板 + LLM 识别用户意图
 */

import { llmService, LLMMessage } from './llm.service';
import { SessionData } from '../conversation/session-manager.service';
import { logger } from '../../utils/logger';

export interface IntentResult {
  intent: string;
  confidence: number;
  entities?: Record<string, any>;
  rawResponse?: string;
}

export interface IntentDefinition {
  name: string;
  description: string;
  examples: string[];
}

// 预定义意图
const INTENTS: IntentDefinition[] = [
  {
    name: 'greeting',
    description: '问候、打招呼',
    examples: ['你好', '您好', '早上好', '嗨'],
  },
  {
    name: 'product_inquiry',
    description: '产品咨询、询问产品信息',
    examples: ['这个产品多少钱', '有什么功能', '产品参数是什么'],
  },
  {
    name: 'order_status',
    description: '订单状态查询',
    examples: ['我的订单到哪了', '查询订单状态', '订单什么时候发货'],
  },
  {
    name: 'refund_request',
    description: '退款申请',
    examples: ['我要退款', '怎么退货', '退款流程'],
  },
  {
    name: 'technical_support',
    description: '技术支持、使用问题',
    examples: ['这个怎么用', '出错了怎么办', '无法登录'],
  },
  {
    name: 'handoff_request',
    description: '请求转人工客服',
    examples: ['转人工', '我要和人工对话', '叫你们客服来'],
  },
  {
    name: 'complaint',
    description: '投诉、抱怨',
    examples: ['我要投诉', '服务太差了', '你们怎么回事'],
  },
  {
    name: 'farewell',
    description: '告别、结束对话',
    examples: ['再见', '谢谢', '先这样吧'],
  },
  {
    name: 'other',
    description: '其他意图',
    examples: ['今天天气怎么样', '你叫什么名字'],
  },
];

// 意图识别 Prompt 模板
const INTENT_PROMPT_TEMPLATE = `你是一个智能客服意图识别助手。请分析用户的输入，识别其意图。

## 可选意图列表：
{{intents}}

## 对话历史：
{{context}}

## 当前用户输入：
{{message}}

## 输出格式（JSON）：
{
  "intent": "意图名称",
  "confidence": 0.0-1.0 之间的置信度,
  "entities": {
    // 提取的实体信息，如订单号、产品名等
  }
}

## 要求：
1. 只输出 JSON，不要其他内容
2. 置信度根据匹配程度给出（完全匹配 0.9-1.0，部分匹配 0.6-0.9，模糊匹配 0.3-0.6）
3. 如果置信度低于 0.3，intent 设为 "other"
4. 提取关键实体信息（如订单号、产品名、时间等）

请分析并输出 JSON：`;

export class IntentRecognitionService {
  /**
   * 识别用户意图
   */
  async recognizeIntent(message: string, session?: SessionData): Promise<IntentResult> {
    try {
      // 构建 intents 列表
      const intentsText = INTENTS.map(i => 
        `- ${i.name}: ${i.description}（例如：${i.examples.slice(0, 3).join(', ')}）`
      ).join('\n');

      // 获取对话上下文
      const context = session 
        ? `会话 ID: ${session.sessionId}\n租户：${session.tenantId}`
        : '无历史对话';

      // 构建 Prompt
      const prompt = INTENT_PROMPT_TEMPLATE
        .replace('{{intents}}', intentsText)
        .replace('{{context}}', context)
        .replace('{{message}}', message);

      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是一个专业的意图识别助手，输出严格的 JSON 格式。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      // 调用 LLM
      const response = await llmService.recognizeIntent(messages);
      
      // 解析响应
      const result = this.parseIntentResponse(response.content);
      result.rawResponse = response.content;

      logger.debug('意图识别完成', {
        intent: result.intent,
        confidence: result.confidence,
        entities: result.entities,
      });

      return result;
    } catch (error: any) {
      logger.error('意图识别失败', { error, message });
      
      // 降级处理：返回其他意图
      return {
        intent: 'other',
        confidence: 0,
        entities: {},
        rawResponse: `错误：${error.message}`,
      };
    }
  }

  /**
   * 解析 LLM 返回的意图识别结果
   */
  private parseIntentResponse(content: string): IntentResult {
    try {
      // 清理响应，提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('未找到 JSON 格式');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证字段
      if (!parsed.intent || typeof parsed.confidence !== 'number') {
        throw new Error('JSON 格式不正确');
      }

      return {
        intent: parsed.intent,
        confidence: Math.min(Math.max(parsed.confidence, 0), 1), // 限制在 0-1 之间
        entities: parsed.entities || {},
      };
    } catch (error) {
      logger.warn('解析意图响应失败，使用默认值', { error, content });
      
      return {
        intent: 'other',
        confidence: 0,
        entities: {},
      };
    }
  }

  /**
   * 检查是否是转人工请求
   */
  isHandoffRequest(intent: string, entities?: Record<string, any>): boolean {
    return intent === 'handoff_request' || entities?.handoff === true;
  }

  /**
   * 获取所有预定义意图
   */
  getAvailableIntents(): IntentDefinition[] {
    return [...INTENTS];
  }
}

// 单例
export const intentRecognitionService = new IntentRecognitionService();
