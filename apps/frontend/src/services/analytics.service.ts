/**
 * 数据分析 API 服务
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  transferredConversations: number;
  avgDuration: number;
  resolutionRate: number;
  transferRate: number;
}

export interface ConversationTrend {
  dates: string[];
  total: number[];
  resolved: number[];
  transferred: number[];
}

export interface FAQItem {
  question: string;
  count: number;
  category?: string;
}

export interface ResponseTimeStats {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  responseTimeTrend: Array<{
    date: string;
    value: number;
  }>;
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  tenantId: string;
  totalConversations: number;
  resolvedConversations: number;
  resolutionRate: number;
  avgResponseTime: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  satisfactionScore?: number;
  onlineHours: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface AgentRanking {
  agentId: string;
  agentName: string;
  score: number;
  rank: number;
}

export interface SatisfactionStats {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: Array<{
    rating: number;
    count: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    averageRating: number;
    count: number;
  }>;
  topTags: Array<{
    tag: string;
    count: number;
  }>;
}

class AnalyticsService {
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

  // ==================== 对话统计 ====================

  /**
   * 获取对话统计
   */
  async getConversationStats(
    startDate?: string,
    endDate?: string
  ): Promise<ConversationStats> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await this.axiosInstance.get('/analytics/conversations', { params });
    return response.data.data;
  }

  /**
   * 获取对话趋势
   */
  async getConversationTrend(
    granularity: 'day' | 'week' | 'month' = 'day',
    days: number = 30
  ): Promise<ConversationTrend> {
    const params = { granularity, days };
    const response = await this.axiosInstance.get('/analytics/conversations/trend', { params });
    return response.data.data;
  }

  /**
   * 获取常见问题 TOP10
   */
  async getTopFAQs(
    limit: number = 10,
    days: number = 30
  ): Promise<FAQItem[]> {
    const params = { limit, days };
    const response = await this.axiosInstance.get('/analytics/faq/top', { params });
    return response.data.data;
  }

  /**
   * 获取响应时间统计
   */
  async getResponseTimeStats(days: number = 30): Promise<ResponseTimeStats> {
    const params = { days };
    const response = await this.axiosInstance.get('/analytics/response-time', { params });
    return response.data.data;
  }

  // ==================== 坐席绩效 ====================

  /**
   * 获取坐席绩效
   */
  async getAgentPerformance(
    agentId: string,
    startDate: string,
    endDate: string
  ): Promise<AgentPerformance> {
    const params = { startDate, endDate };
    const response = await this.axiosInstance.get(
      `/analytics/agents/${agentId}/performance`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 获取坐席排名
   */
  async getAgentRanking(
    startDate: string,
    endDate: string
  ): Promise<AgentRanking[]> {
    const params = { startDate, endDate };
    const response = await this.axiosInstance.get('/analytics/agents/ranking', { params });
    return response.data.data;
  }

  /**
   * 获取团队统计
   */
  async getTeamStats(
    startDate: string,
    endDate: string
  ): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    avgConversationsPerAgent: number;
    teamResolutionRate: number;
    teamAvgResponseTime: number;
  }> {
    const params = { startDate, endDate };
    const response = await this.axiosInstance.get('/analytics/agents/team-stats', { params });
    return response.data.data;
  }

  /**
   * 获取坐席工作量
   */
  async getAgentWorkload(
    agentId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{
    date: string;
    conversations: number;
    messages: number;
    avgResponseTime: number;
  }>> {
    const params = { startDate, endDate };
    const response = await this.axiosInstance.get(
      `/analytics/agents/${agentId}/workload`,
      { params }
    );
    return response.data.data;
  }

  // ==================== 满意度 ====================

  /**
   * 获取满意度统计
   */
  async getSatisfactionStats(
    startDate?: string,
    endDate?: string
  ): Promise<SatisfactionStats> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await this.axiosInstance.get('/analytics/satisfaction', { params });
    return response.data.data;
  }

  /**
   * 获取坐席满意度
   */
  async getAgentSatisfaction(
    agentId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    averageRating: number;
    totalRatings: number;
    ratingDistribution: Array<{
      rating: number;
      count: number;
      percentage: number;
    }>;
  }> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await this.axiosInstance.get(
      `/analytics/agents/${agentId}/satisfaction`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 提交满意度评价
   */
  async submitRating(data: {
    conversationId: string;
    rating: number;
    comment?: string;
    tags?: string[];
  }): Promise<{
    id: string;
    conversationId: string;
    rating: number;
    comment?: string;
    tags?: string[];
    createdAt: Date;
  }> {
    const response = await this.axiosInstance.post('/analytics/satisfaction/rating', data);
    return response.data.data;
  }

  /**
   * 获取最近评价
   */
  async getRecentRatings(limit: number = 20): Promise<Array<{
    id: string;
    conversationId: string;
    rating: number;
    comment?: string;
    tags?: string[];
    createdAt: Date;
  }>> {
    const params = { limit };
    const response = await this.axiosInstance.get('/analytics/satisfaction/recent', { params });
    return response.data.data;
  }
}

export const analyticsService = new AnalyticsService();
