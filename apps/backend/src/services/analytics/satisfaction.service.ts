/**
 * 用户满意度分析服务
 * 收集和分析用户对对话的满意度评价
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface SatisfactionRating {
  id: string;
  conversationId: string;
  tenantId: string;
  agentId?: string;
  rating: number; // 1-5 分
  comment?: string;
  tags?: string[]; // 评价标签
  createdAt: Date;
}

export interface SatisfactionStats {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: {
    rating: number;
    count: number;
    percentage: number;
  }[];
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

export class SatisfactionService {
  /**
   * 提交满意度评价
   */
  async submitRating(data: {
    conversationId: string;
    tenantId: string;
    agentId?: string;
    rating: number;
    comment?: string;
    tags?: string[];
  }): Promise<SatisfactionRating> {
    // 验证评分范围
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('评分必须在 1-5 之间');
    }

    // 检查是否已存在评价
    const existing = await prisma.satisfactionRating.findFirst({
      where: {
        conversationId: data.conversationId,
      },
    });

    if (existing) {
      throw new Error('该对话已有评价');
    }

    // 创建评价记录
    const rating = await prisma.satisfactionRating.create({
      data: {
        conversationId: data.conversationId,
        tenantId: data.tenantId,
        agentId: data.agentId,
        rating: data.rating,
        comment: data.comment,
        tags: data.tags || [],
      },
    });

    logger.info('满意度评价已提交', {
      conversationId: data.conversationId,
      rating: data.rating,
    });

    return rating;
  }

  /**
   * 获取满意度统计
   */
  async getSatisfactionStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SatisfactionStats> {
    const where: any = { tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 获取所有评价
    const ratings = await prisma.satisfactionRating.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalRatings = ratings.length;

    if (totalRatings === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: [],
        trend: [],
        topTags: [],
      };
    }

    // 计算平均评分
    const sumRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = sumRating / totalRatings;

    // 评分分布
    const distribution = new Map<number, number>();
    for (let i = 1; i <= 5; i++) {
      distribution.set(i, 0);
    }
    ratings.forEach(r => {
      distribution.set(r.rating, (distribution.get(r.rating) || 0) + 1);
    });

    const ratingDistribution = Array.from(distribution.entries())
      .map(([rating, count]) => ({
        rating,
        count,
        percentage: Math.round((count / totalRatings) * 100 * 100) / 100,
      }))
      .reverse(); // 5 分到 1 分

    // 按日期统计趋势
    const dateMap = new Map<string, { sum: number; count: number }>();
    ratings.forEach(r => {
      const date = r.createdAt.toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { sum: 0, count: 0 });
      }
      const data = dateMap.get(date)!;
      data.sum += r.rating;
      data.count += 1;
    });

    const trend = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        averageRating: Math.round((data.sum / data.count) * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 热门标签统计
    const tagMap = new Map<string, number>();
    ratings.forEach(r => {
      if (r.tags) {
        r.tags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      }
    });

    const topTags = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalRatings,
      ratingDistribution,
      trend,
      topTags,
    };
  }

  /**
   * 获取坐席的满意度统计
   */
  async getAgentSatisfactionStats(
    agentId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    averageRating: number;
    totalRatings: number;
    ratingDistribution: {
      rating: number;
      count: number;
      percentage: number;
    }[];
  }> {
    const where: any = { agentId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const ratings = await prisma.satisfactionRating.findMany({
      where,
    });

    const totalRatings = ratings.length;

    if (totalRatings === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: [],
      };
    }

    const sumRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = sumRating / totalRatings;

    const distribution = new Map<number, number>();
    for (let i = 1; i <= 5; i++) {
      distribution.set(i, 0);
    }
    ratings.forEach(r => {
      distribution.set(r.rating, (distribution.get(r.rating) || 0) + 1);
    });

    const ratingDistribution = Array.from(distribution.entries())
      .map(([rating, count]) => ({
        rating,
        count,
        percentage: Math.round((count / totalRatings) * 100 * 100) / 100,
      }))
      .reverse();

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalRatings,
      ratingDistribution,
    };
  }

  /**
   * 获取最近的评价列表
   */
  async getRecentRatings(
    tenantId: string,
    limit: number = 20
  ): Promise<SatisfactionRating[]> {
    return await prisma.satisfactionRating.findMany({
      where: { tenantId },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        conversation: {
          select: {
            id: true,
            status: true,
            startedAt: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}

// 单例
export const satisfactionService = new SatisfactionService();
