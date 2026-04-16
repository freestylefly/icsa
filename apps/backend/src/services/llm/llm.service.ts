/**
 * LLM 调用服务（阿里云通义千问 Qwen-Max）
 */

import { logger } from '../../utils/logger';
import { llmConfig, intentConfig, ragConfig } from '../../config/llm.config';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  isLast: boolean;
}

export class LLMService {
  /**
   * 调用 LLM API（非流式）
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const {
      messages,
      model = llmConfig.model,
      temperature = llmConfig.temperature,
      maxTokens = llmConfig.maxTokens,
    } = request;

    try {
      const response = await fetch(`${llmConfig.baseUrl}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages,
          },
          parameters: {
            temperature,
            max_tokens: maxTokens,
            result_format: 'message',
          },
        }),
        signal: AbortSignal.timeout(llmConfig.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API 错误：${response.status} ${error}`);
      }

      const data = await response.json();
      
      const llmResponse: LLMResponse = {
        content: data.output?.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };

      logger.debug('LLM 调用成功', {
        model,
        tokens: llmResponse.usage?.totalTokens,
      });

      return llmResponse;
    } catch (error: any) {
      logger.error('LLM 调用失败', { error, model });
      throw new Error(`LLM 调用失败：${error.message}`);
    }
  }

  /**
   * 调用 LLM API（流式）
   */
  async *chatStream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    const {
      messages,
      model = ragConfig.model,
      temperature = ragConfig.temperature,
      maxTokens = ragConfig.maxTokens,
    } = request;

    try {
      const response = await fetch(`${llmConfig.baseUrl}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages,
          },
          parameters: {
            temperature,
            max_tokens: maxTokens,
            result_format: 'message',
            incremental_output: true, // 增量输出
          },
          stream: true,
        }),
        signal: AbortSignal.timeout(llmConfig.timeout),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API 错误：${response.status} ${error}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          yield { content: '', isLast: true };
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { content: '', isLast: true };
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.output?.choices?.[0]?.message?.content || '';
              
              if (content) {
                yield { content, isLast: false };
              }
            } catch (e) {
              // 跳过解析失败的行
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('LLM 流式调用失败', { error, model });
      throw new Error(`LLM 流式调用失败：${error.message}`);
    }
  }

  /**
   * 意图识别专用调用
   */
  async recognizeIntent(messages: LLMMessage[]): Promise<LLMResponse> {
    return this.chat({
      messages,
      model: intentConfig.model,
      temperature: intentConfig.temperature,
      maxTokens: intentConfig.maxTokens,
    });
  }

  /**
   * RAG 回答生成专用调用
   */
  async generateRAGResponse(messages: LLMMessage[], stream: boolean = false) {
    if (stream) {
      return this.chatStream({
        messages,
        model: ragConfig.model,
        temperature: ragConfig.temperature,
        maxTokens: ragConfig.maxTokens,
        stream: true,
      });
    } else {
      return this.chat({
        messages,
        model: ragConfig.model,
        temperature: ragConfig.temperature,
        maxTokens: ragConfig.maxTokens,
      });
    }
  }
}

// 单例
export const llmService = new LLMService();
