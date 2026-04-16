/**
 * RAG 回答生成服务
 * 知识检索 + Prompt 组装 + LLM 生成回答
 */

import { llmService, LLMMessage, StreamChunk } from './llm.service';
import { historyManager, SearchSource } from '../conversation/history-manager.service';
import { vectorSearch, SearchResult as VectorSearchResult } from '../knowledge/vector-store.service';
import { IntentResult } from './intent-recognition.service';
import { logger } from '../../utils/logger';

export interface RAGResponse {
  content: string;
  sources: SearchSource[];
}

export interface RAGRequest {
  sessionId: string;
  message: string;
  intent: IntentResult;
  tenantId: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string, sources?: SearchSource[]) => void;
  onError: (error: Error) => void;
}

// RAG Prompt 模板
const RAG_PROMPT_TEMPLATE = `你是一个专业的智能客服助手。请根据以下信息回答用户的问题。

## 系统提示：
{{systemPrompt}}

## 对话历史：
{{conversationHistory}}

## 相关知识片段：
{{knowledgeChunks}}

## 当前用户问题：
{{message}}

## 回答要求：
1. 基于提供的知识片段回答问题
2. 如果知识片段不足以回答问题，诚实地告诉用户
3. 回答要简洁、清晰、专业
4. 在回答末尾标注引用来源（如果有）
5. 使用友好的语气

请生成回答：`;

// 系统提示模板
const SYSTEM_PROMPT_TEMPLATES: Record<string, string> = {
  greeting: '你是一个友好的客服助手。用户正在打招呼，请热情回应。',
  product_inquiry: '你是一个专业的产品顾问。请根据知识库中的产品信息回答用户问题。',
  order_status: '你是一个订单助手。请根据知识库中的订单政策回答用户问题，如果需要查询具体订单，请引导用户提供订单号。',
  refund_request: '你是一个售后专家。请根据知识库中的退款政策回答用户问题，并引导用户完成退款流程。',
  technical_support: '你是一个技术支持专家。请根据知识库中的技术文档回答用户问题，提供清晰的解决步骤。',
  complaint: '你是一个客户关系专家。请耐心倾听用户的投诉，表达理解和歉意，并提供解决方案。',
  farewell: '你是一个友好的客服助手。用户准备结束对话，请礼貌告别并表达感谢。',
  handoff_request: '你是一个客服助手。用户请求转人工，请确认并告知用户稍候。',
  other: '你是一个通用的智能客服助手。请尽力回答用户的问题，如果不确定，建议用户转人工客服。',
};

export class RAGGeneratorService {
  /**
   * 生成 RAG 回答（非流式）
   */
  async generateResponse(request: RAGRequest): Promise<RAGResponse> {
    const { sessionId, message, intent, tenantId } = request;

    try {
      // 1. 知识检索
      const searchResults = await this.searchKnowledge(message, tenantId);

      // 2. 获取对话历史
      const conversationHistory = await historyManager.getContextForPrompt(sessionId, 5);

      // 3. 选择系统提示
      const systemPrompt = SYSTEM_PROMPT_TEMPLATES[intent.intent] || SYSTEM_PROMPT_TEMPLATES.other;

      // 4. 组装知识片段
      const knowledgeChunksText = this.formatKnowledgeChunks(searchResults);

      // 5. 构建 Prompt
      const prompt = RAG_PROMPT_TEMPLATE
        .replace('{{systemPrompt}}', systemPrompt)
        .replace('{{conversationHistory}}', conversationHistory || '无历史对话')
        .replace('{{knowledgeChunks}}', knowledgeChunksText)
        .replace('{{message}}', message);

      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是一个专业的智能客服助手，基于提供的知识片段回答问题。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      // 6. 调用 LLM
      const llmResponse = await llmService.generateRAGResponse(messages, false);

      // 7. 添加引用标注
      const content = this.addCitations(llmResponse.content, searchResults);

      return {
        content,
        sources: searchResults.map(r => ({
          chunkId: r.chunkId,
          content: r.content,
          documentName: r.documentName,
          similarity: r.similarity,
        })),
      };
    } catch (error: any) {
      logger.error('RAG 回答生成失败', { error, request });
      throw error;
    }
  }

  /**
   * 生成 RAG 回答（流式）
   */
  async generateResponseStream(
    request: RAGRequest,
    callbacks: StreamCallbacks
  ): Promise<RAGResponse> {
    const { sessionId, message, intent, tenantId } = request;

    try {
      // 1. 知识检索
      const searchResults = await this.searchKnowledge(message, tenantId);

      // 2. 获取对话历史
      const conversationHistory = await historyManager.getContextForPrompt(sessionId, 5);

      // 3. 选择系统提示
      const systemPrompt = SYSTEM_PROMPT_TEMPLATES[intent.intent] || SYSTEM_PROMPT_TEMPLATES.other;

      // 4. 组装知识片段
      const knowledgeChunksText = this.formatKnowledgeChunks(searchResults);

      // 5. 构建 Prompt
      const prompt = RAG_PROMPT_TEMPLATE
        .replace('{{systemPrompt}}', systemPrompt)
        .replace('{{conversationHistory}}', conversationHistory || '无历史对话')
        .replace('{{knowledgeChunks}}', knowledgeChunksText)
        .replace('{{message}}', message);

      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: '你是一个专业的智能客服助手，基于提供的知识片段回答问题。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      // 6. 流式调用 LLM
      let fullResponse = '';
      
      for await (const chunk of llmService.chatStream({ messages, stream: true })) {
        if (chunk.content) {
          fullResponse += chunk.content;
          callbacks.onToken(chunk.content);
        }
      }

      // 7. 添加引用标注
      const content = this.addCitations(fullResponse, searchResults);

      // 8. 完成回调
      callbacks.onComplete(content, searchResults.map(r => ({
        chunkId: r.chunkId,
        content: r.content,
        documentName: r.documentName,
        similarity: r.similarity,
      })));

      return {
        content,
        sources: searchResults.map(r => ({
          chunkId: r.chunkId,
          content: r.content,
          documentName: r.documentName,
          similarity: r.similarity,
        })),
      };
    } catch (error: any) {
      logger.error('RAG 流式回答生成失败', { error, request });
      callbacks.onError(error);
      throw error;
    }
  }

  /**
   * 知识检索
   */
  private async searchKnowledge(message: string, tenantId: string): Promise<VectorSearchResult[]> {
    try {
      // TODO: 调用 embedding service 获取 query embedding
      // 这里暂时使用占位符，实际使用时需要集成 embedding service
      
      // 模拟 embedding（实际应该调用 embedding API）
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

      const results = await vectorSearch(mockEmbedding, {
        topK: 5,
        minSimilarity: 0.5,
        filter: {
          // 可以根据 tenantId 过滤（需要在 KnowledgeChunk 中添加 tenantId 字段）
        },
      });

      return results;
    } catch (error: any) {
      logger.error('知识检索失败', { error });
      return [];
    }
  }

  /**
   * 格式化知识片段
   */
  private formatKnowledgeChunks(chunks: VectorSearchResult[]): string {
    if (chunks.length === 0) {
      return '暂无相关知识片段';
    }

    return chunks
      .map((chunk, index) => {
        const source = chunk.documentName ? `（来源：${chunk.documentName}）` : '';
        return `[${index + 1}]${source}\n${chunk.content}\n相似度：${chunk.similarity.toFixed(2)}`;
      })
      .join('\n\n');
  }

  /**
   * 添加引用标注
   */
  private addCitations(content: string, chunks: VectorSearchResult[]): string {
    if (chunks.length === 0) {
      return content;
    }

    const citations = chunks
      .slice(0, 3) // 最多标注 3 个来源
      .map((chunk, index) => {
        const source = chunk.documentName || '未知文档';
        return `[${index + 1}] ${source}`;
      })
      .join('\n');

    return `${content}\n\n---\n**参考资料**:\n${citations}`;
  }
}

// 单例
export const ragGeneratorService = new RAGGeneratorService();
