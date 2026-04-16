/**
 * 对话摘要生成服务
 * 使用 LLM 自动生成对话摘要
 */

import { logger } from '../../utils/logger';
import { llmService } from '../llm/llm.service';

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  category?: string;
  resolved: boolean;
  followUpRequired: boolean;
  generatedAt: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

export class SummaryGeneratorService {
  private readonly SUMMARY_PROMPT = `你是一位专业的客服对话分析专家。请分析以下客服对话，生成简洁准确的摘要。

对话内容：
{conversation}

请按照以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "summary": "100 字以内的对话摘要，概括用户问题和解决方案",
  "keyPoints": ["关键点 1", "关键点 2", "关键点 3"],
  "sentiment": "positive|neutral|negative",
  "category": "问题分类（如：产品咨询、技术支持、投诉建议等）",
  "resolved": true/false,
  "followUpRequired": true/false
}

要求：
1. 摘要简洁明了，突出重点
2. 关键点 3-5 个
3. 情感判断准确
4. 问题分类合理
5. 是否解决和是否需要跟进判断准确`;

  /**
   * 生成对话摘要
   */
  async generateSummary(
    conversationId: string,
    messages: Message[]
  ): Promise<ConversationSummary> {
    try {
      // 组装对话内容
      const conversationText = this.formatConversation(messages);

      // 调用 LLM 生成摘要
      const prompt = this.SUMMARY_PROMPT.replace('{conversation}', conversationText);
      
      const response = await llmService.generate({
        prompt,
        model: 'qwen-max',
        temperature: 0.3, // 较低的温度保证输出稳定
        maxTokens: 500,
      });

      // 解析 JSON 响应
      const summaryData = this.parseJsonResponse(response.content);

      const summary: ConversationSummary = {
        conversationId,
        summary: summaryData.summary || '无摘要',
        keyPoints: summaryData.keyPoints || [],
        sentiment: summaryData.sentiment || 'neutral',
        category: summaryData.category,
        resolved: summaryData.resolved ?? false,
        followUpRequired: summaryData.followUpRequired ?? false,
        generatedAt: Date.now(),
      };

      logger.info('对话摘要已生成', {
        conversationId,
        sentiment: summary.sentiment,
        resolved: summary.resolved,
      });

      return summary;
    } catch (error) {
      logger.error('生成对话摘要失败', { conversationId, error });
      
      // 返回基础摘要（降级处理）
      return this.generateBasicSummary(conversationId, messages);
    }
  }

  /**
   * 批量生成摘要
   */
  async generateBatchSummaries(
    conversations: Array<{
      conversationId: string;
      messages: Message[];
    }>,
    concurrency: number = 3
  ): Promise<ConversationSummary[]> {
    const summaries: ConversationSummary[] = [];

    // 分批处理，避免并发过高
    for (let i = 0; i < conversations.length; i += concurrency) {
      const batch = conversations.slice(i, i + concurrency);
      const batchSummaries = await Promise.all(
        batch.map(conv => this.generateSummary(conv.conversationId, conv.messages))
      );
      summaries.push(...batchSummaries);
    }

    return summaries;
  }

  /**
   * 格式化对话内容
   */
  private formatConversation(messages: Message[]): string {
    return messages
      .map(msg => {
        const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '客服' : '系统';
        return `[${role}]: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * 解析 JSON 响应
   */
  private parseJsonResponse(content: string): any {
    try {
      // 尝试提取 JSON 内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (error) {
      logger.warn('解析 JSON 失败，使用默认值', { error, content });
      return {};
    }
  }

  /**
   * 生成基础摘要（降级处理）
   */
  private generateBasicSummary(
    conversationId: string,
    messages: Message[]
  ): ConversationSummary {
    // 提取用户最后一条消息作为摘要
    const lastUserMessage = messages
      .filter(m => m.role === 'user')
      .pop();

    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const assistantMessageCount = messages.filter(m => m.role === 'assistant').length;

    return {
      conversationId,
      summary: lastUserMessage 
        ? `用户咨询：${lastUserMessage.content.substring(0, 50)}...`
        : '无用户消息',
      keyPoints: [],
      sentiment: 'neutral',
      category: '未分类',
      resolved: assistantMessageCount > 0,
      followUpRequired: false,
      generatedAt: Date.now(),
    };
  }
}

// 单例
export const summaryGeneratorService = new SummaryGeneratorService();
