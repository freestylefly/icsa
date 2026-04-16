/**
 * 对话服务核心
 * 整合会话管理、历史管理、意图识别、RAG 生成
 */

import { sessionManager, SessionStatus, SessionData } from './session-manager.service';
import { historyManager, Message, SearchSource } from './history-manager.service';
import { intentRecognitionService, IntentResult } from '../llm/intent-recognition.service';
import { ragGeneratorService, RAGResponse } from '../llm/rag-generator.service';
import { handoffService, HandoffReason } from '../human-handoff/handoff.service';
import { sensitivityFilterService } from '../human-handoff/sensitivity-filter.service';
import { vectorSearch, SearchResult } from '../knowledge/vector-store.service';
import { logger } from '../../utils/logger';

export interface ConversationRequest {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  message: string;
  agentId?: string;
}

export interface ConversationResponse {
  sessionId: string;
  message: Message;
  shouldHandoff: boolean;
  handoffReason?: HandoffReason;
  sources?: SearchSource[];
}

export interface StreamCallback {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string, sources?: SearchSource[]) => void;
  onError: (error: Error) => void;
}

export class ConversationService {
  /**
   * 处理对话请求
   */
  async processMessage(
    request: ConversationRequest
  ): Promise<ConversationResponse> {
    const { tenantId, userId, sessionId, message, agentId } = request;

    try {
      // 1. 获取或创建会话
      let session: SessionData;
      if (sessionId) {
        session = await sessionManager.getSession(sessionId);
        if (!session) {
          // 会话已过期，创建新会话
          session = await sessionManager.createSession(tenantId, userId, agentId);
        }
      } else {
        session = await sessionManager.createSession(tenantId, userId, agentId);
      }

      // 2. 检查会话状态
      if (session.status === SessionStatus.CLOSED) {
        // 重新打开会话
        await sessionManager.updateSessionStatus(session.sessionId, SessionStatus.ACTIVE);
      }

      if (session.status === SessionStatus.TRANSFERRED) {
        // 已转人工，直接返回
        return {
          sessionId: session.sessionId,
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: '您已转接至人工客服，请稍候。',
            timestamp: Date.now(),
          },
          shouldHandoff: true,
          handoffReason: 'already_transferred',
        };
      }

      // 3. 敏感词检测
      const sensitivityCheck = sensitivityFilterService.checkMessage(message);
      if (sensitivityCheck.isSensitive) {
        logger.info('检测到敏感词', { sessionId: session.sessionId, reason: sensitivityCheck.reason });
        
        // 添加用户消息
        await historyManager.addUserMessage(session.sessionId, message);
        
        // 触发转人工
        await handoffService.createHandoff({
          sessionId: session.sessionId,
          tenantId,
          userId,
          reason: 'sensitive_content',
          reasonDetail: sensitivityCheck.reason,
        });

        await sessionManager.transferToHuman(session.sessionId, agentId || 'system', '敏感内容');

        return {
          sessionId: session.sessionId,
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: '您的问题涉及敏感内容，已为您转接人工客服。',
            timestamp: Date.now(),
          },
          shouldHandoff: true,
          handoffReason: 'sensitive_content',
        };
      }

      // 4. 意图识别
      const intentResult = await intentRecognitionService.recognizeIntent(message, session);
      logger.info('意图识别结果', { 
        sessionId: session.sessionId, 
        intent: intentResult.intent, 
        confidence: intentResult.confidence 
      });

      // 5. 添加用户消息到历史
      await historyManager.addUserMessage(session.sessionId, message, {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
      });

      // 6. 判断是否需要转人工（低置信度）
      if (intentResult.confidence < 0.6) {
        logger.info('置信度低于阈值，转人工', { 
          sessionId: session.sessionId, 
          confidence: intentResult.confidence 
        });

        await handoffService.createHandoff({
          sessionId: session.sessionId,
          tenantId,
          userId,
          reason: 'low_confidence',
          reasonDetail: `置信度：${intentResult.confidence.toFixed(2)}`,
        });

        await sessionManager.transferToHuman(session.sessionId, agentId || 'system', '低置信度');

        return {
          sessionId: session.sessionId,
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: '我不太理解您的问题，已为您转接人工客服。',
            timestamp: Date.now(),
          },
          shouldHandoff: true,
          handoffReason: 'low_confidence',
        };
      }

      // 7. 检查是否是转人工请求
      if (intentResult.intent === 'handoff_request' || intentResult.entities?.handoff) {
        await handoffService.createHandoff({
          sessionId: session.sessionId,
          tenantId,
          userId,
          reason: 'user_request',
        });

        await sessionManager.transferToHuman(session.sessionId, agentId || 'system', '用户请求');

        return {
          sessionId: session.sessionId,
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: '好的，已为您转接人工客服，请稍候。',
            timestamp: Date.now(),
          },
          shouldHandoff: true,
          handoffReason: 'user_request',
        };
      }

      // 8. RAG 回答生成
      const ragResponse = await ragGeneratorService.generateResponse({
        sessionId: session.sessionId,
        message,
        intent: intentResult,
        tenantId,
      });

      // 9. 添加助手消息到历史
      await historyManager.addAssistantMessage(session.sessionId, ragResponse.content, {
        sources: ragResponse.sources,
      });

      // 10. 更新会话活动时间
      await sessionManager.updateLastActivity(session.sessionId);

      return {
        sessionId: session.sessionId,
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: ragResponse.content,
          timestamp: Date.now(),
          metadata: {
            sources: ragResponse.sources,
          },
        },
        shouldHandoff: false,
        sources: ragResponse.sources,
      };
    } catch (error) {
      logger.error('处理对话失败', { error, request });
      throw error;
    }
  }

  /**
   * 流式处理对话（SSE）
   */
  async processMessageStream(
    request: ConversationRequest,
    callbacks: StreamCallback
  ): Promise<string> {
    const { tenantId, userId, sessionId, message, agentId } = request;

    try {
      // 1-6 步与同步处理相同（省略，复用上面的逻辑）
      let session: SessionData;
      if (sessionId) {
        session = await sessionManager.getSession(sessionId);
        if (!session) {
          session = await sessionManager.createSession(tenantId, userId, agentId);
        }
      } else {
        session = await sessionManager.createSession(tenantId, userId, agentId);
      }

      // 敏感词检测
      const sensitivityCheck = sensitivityFilterService.checkMessage(message);
      if (sensitivityCheck.isSensitive) {
        callbacks.onToken('您的问题涉及敏感内容，已为您转接人工客服。');
        callbacks.onComplete('您的问题涉及敏感内容，已为您转接人工客服。', []);
        return session.sessionId;
      }

      // 意图识别
      const intentResult = await intentRecognitionService.recognizeIntent(message, session);
      await historyManager.addUserMessage(session.sessionId, message, {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
      });

      // 低置信度转人工
      if (intentResult.confidence < 0.6) {
        callbacks.onToken('我不太理解您的问题，已为您转接人工客服。');
        callbacks.onComplete('我不太理解您的问题，已为您转接人工客服。', []);
        return session.sessionId;
      }

      // RAG 流式生成
      const ragResponse = await ragGeneratorService.generateResponseStream(
        {
          sessionId: session.sessionId,
          message,
          intent: intentResult,
          tenantId,
        },
        {
          onToken: callbacks.onToken,
          onComplete: (fullResponse, sources) => {
            historyManager.addAssistantMessage(session.sessionId, fullResponse, {
              sources,
            });
            sessionManager.updateLastActivity(session.sessionId);
            callbacks.onComplete(fullResponse, sources);
          },
          onError: callbacks.onError,
        }
      );

      return session.sessionId;
    } catch (error) {
      logger.error('流式处理对话失败', { error, request });
      callbacks.onError(error as Error);
      throw error;
    }
  }

  /**
   * 关闭会话
   */
  async closeSession(sessionId: string): Promise<void> {
    await sessionManager.closeSession(sessionId);
    logger.info('会话已关闭', { sessionId });
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(sessionId: string): Promise<Message[]> {
    return await historyManager.getHistory(sessionId);
  }
}

// 单例
export const conversationService = new ConversationService();
