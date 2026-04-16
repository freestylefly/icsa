/**
 * 坐席管理 API 服务
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface AgentSession {
  agentId: string;
  tenantId: string;
  userId: string;
  status: 'online' | 'busy' | 'offline' | 'break';
  maxConcurrentSessions: number;
  currentSessions: number;
  lastActiveAt: number;
  metadata?: {
    nickname?: string;
    avatar?: string;
    skills?: string[];
  };
}

export interface SessionDistribution {
  id: string;
  conversationId: string;
  tenantId: string;
  agentId: string;
  strategy: 'round_robin' | 'load_balance' | 'skill_based';
  distributedAt: number;
  acceptedAt?: number;
  rejectedAt?: number;
  reason?: string;
}

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

class AgentService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 添加认证拦截器
    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (tenantId) {
        config.headers['x-tenant-id'] = tenantId;
      }
      
      return config;
    });
  }

  /**
   * 设置坐席状态
   */
  async setAgentStatus(
    agentId: string,
    status: AgentSession['status'],
    metadata?: AgentSession['metadata']
  ): Promise<AgentSession> {
    const response = await this.axiosInstance.put(`/agents/${agentId}/status`, {
      status,
      metadata,
    });
    return response.data.data;
  }

  /**
   * 获取坐席状态
   */
  async getAgentStatus(agentId: string): Promise<AgentSession | null> {
    const response = await this.axiosInstance.get(`/agents/${agentId}/status`);
    return response.data.data;
  }

  /**
   * 获取坐席列表
   */
  async getAgents(status?: 'online' | 'all'): Promise<AgentSession[]> {
    const params = status ? { status } : {};
    const response = await this.axiosInstance.get('/agents', { params });
    return response.data.data;
  }

  /**
   * 分配会话
   */
  async distributeSession(
    conversationId: string,
    strategy: 'round_robin' | 'load_balance' | 'skill_based' = 'load_balance',
    requiredSkills?: string[]
  ): Promise<SessionDistribution | null> {
    const response = await this.axiosInstance.post('/agents/sessions/distribute', {
      conversationId,
      strategy,
      requiredSkills,
    });
    return response.data.data;
  }

  /**
   * 接受会话
   */
  async acceptSession(distributionId: string): Promise<void> {
    await this.axiosInstance.post(`/agents/sessions/${distributionId}/accept`);
  }

  /**
   * 拒绝会话
   */
  async rejectSession(distributionId: string, reason?: string): Promise<void> {
    await this.axiosInstance.post(`/agents/sessions/${distributionId}/reject`, { reason });
  }

  /**
   * 完成会话
   */
  async completeSession(conversationId: string): Promise<void> {
    await this.axiosInstance.post(`/agents/sessions/${conversationId}/complete`);
  }

  /**
   * 获取坐席的会话列表
   */
  async getAgentSessions(agentId: string): Promise<SessionDistribution[]> {
    const response = await this.axiosInstance.get(`/agents/${agentId}/sessions`);
    return response.data.data;
  }

  /**
   * 生成对话摘要
   */
  async generateSummary(conversationId: string): Promise<ConversationSummary> {
    const response = await this.axiosInstance.post(`/agents/sessions/${conversationId}/summary`);
    return response.data.data;
  }

  /**
   * 获取等待队列
   */
  async getPendingSessions(): Promise<Array<{
    conversationId: string;
    tenantId: string;
    strategy: string;
    queuedAt: number;
  }>> {
    const response = await this.axiosInstance.get('/agents/sessions/pending');
    return response.data.data;
  }
}

export const agentService = new AgentService();
