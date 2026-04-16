/**
 * Conversation Hook
 * 管理对话状态、消息发送、历史加载
 */

import { useState, useCallback, useEffect } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    sources?: {
      chunkId: string;
      content: string;
      documentName?: string;
      similarity: number;
    }[];
    intent?: string;
    confidence?: number;
  };
}

interface ConversationState {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sessionId: string | null;
}

export function useConversation(apiBaseUrl: string, tenantId: string) {
  const [state, setState] = useState<ConversationState>({
    messages: [],
    isLoading: false,
    error: null,
    sessionId: null,
  });

  // 发送消息（非流式）
  const sendMessage = useCallback(async (
    content: string,
    existingSessionId?: string
  ): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 添加用户消息到本地状态
      const userMessage: Message = {
        id: `local_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // 调用 API
      const response = await fetch(`${apiBaseUrl}/api/conversations/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          sessionId: existingSessionId,
          message: content,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '发送消息失败');
      }

      const data = await response.json();
      
      // 添加助手消息到本地状态
      const assistantMessage: Message = {
        id: data.data.message.id,
        role: 'assistant',
        content: data.data.message.content,
        timestamp: data.data.message.timestamp,
        metadata: data.data.message.metadata,
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        sessionId: data.data.sessionId,
      }));

      return data.data.sessionId;
    } catch (err: any) {
      console.error('发送消息失败', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err,
      }));
      return null;
    }
  }, [apiBaseUrl, tenantId]);

  // 发送消息（流式 SSE）
  const sendMessageStream = useCallback(async (
    content: string,
    existingSessionId?: string,
    callbacks?: {
      onToken?: (token: string) => void;
      onComplete?: (fullResponse: string, sources?: any[]) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 添加用户消息到本地状态
      const userMessage: Message = {
        id: `local_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // 构建 SSE 请求 URL
      const params = new URLSearchParams({
        tenantId,
        message: content,
      });

      if (existingSessionId) {
        params.append('sessionId', existingSessionId);
      }

      const response = await fetch(`${apiBaseUrl}/api/conversations/messages/stream?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        throw new Error('SSE 连接失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('响应体为空');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let sessionId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              callbacks?.onComplete?.(fullResponse);
              setState(prev => ({
                ...prev,
                isLoading: false,
                sessionId: sessionId || prev.sessionId,
              }));
              return sessionId;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'token') {
                fullResponse += parsed.content;
                callbacks?.onToken?.(parsed.content);
              } else if (parsed.type === 'complete') {
                fullResponse = parsed.content;
                callbacks?.onComplete?.(parsed.content, parsed.sources);
                
                // 添加完整的助手消息
                const assistantMessage: Message = {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content: parsed.content,
                  timestamp: Date.now(),
                  metadata: {
                    sources: parsed.sources,
                  },
                };

                setState(prev => ({
                  ...prev,
                  messages: [...prev.messages, assistantMessage],
                  isLoading: false,
                  sessionId: sessionId || prev.sessionId,
                }));
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // 跳过解析失败的行
            }
          }
        }
      }
    } catch (err: any) {
      console.error('流式消息失败', err);
      callbacks?.onError?.(err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err,
      }));
      return null;
    }
  }, [apiBaseUrl, tenantId]);

  // 加载会话历史
  const connectToSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/conversations/${sessionId}/history`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('加载历史失败');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        messages: data.data.messages || [],
        sessionId,
      }));
    } catch (err: any) {
      console.error('加载历史失败', err);
    }
  }, [apiBaseUrl]);

  // 清空消息
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
    }));
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sessionId: state.sessionId,
    sendMessage,
    sendMessageStream,
    connectToSession,
    clearMessages,
    clearError,
  };
}
