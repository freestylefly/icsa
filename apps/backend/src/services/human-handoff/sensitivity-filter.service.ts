/**
 * 敏感词检测服务
 * 检测用户消息中的敏感词，触发转人工
 */

import { logger } from '../../utils/logger';

export interface SensitivityCheckResult {
  isSensitive: boolean;
  reason?: string;
  matchedWords?: string[];
}

// 敏感词分类
const SENSITIVE_WORDS: Record<string, string[]> = {
  // 政治敏感
  politics: [
    '政府', '政治', '领导人', '政策', '维权', '上访',
  ],
  // 色情相关
  adult: [
    '色情', '成人', '性', '裸体',
  ],
  // 暴力相关
  violence: [
    '暴力', '打架', '杀人', '伤害', '自杀',
  ],
  // 辱骂/攻击性语言
  abuse: [
    '傻逼', '混蛋', '去死', '垃圾', '废物',
  ],
  // 投诉/威胁
  complaint: [
    '投诉', '举报', '曝光', '媒体', '起诉', '告你们',
  ],
  // 竞品
  competitor: [
    '淘宝', '京东', '拼多多', '竞争对手名称',
  ],
};

// 转人工触发词（用户主动请求）
const HANDOFF_TRIGGER_WORDS = [
  '转人工', '人工客服', '人工服务', '真人', '活人',
  '客服', '打电话', '联系你们', '找你们',
];

export class SensitivityFilterService {
  /**
   * 检查消息是否包含敏感词
   */
  checkMessage(message: string): SensitivityCheckResult {
    const lowerMessage = message.toLowerCase();

    // 检查转人工触发词（这些不算敏感，只是触发转人工）
    const handoffMatches = HANDOFF_TRIGGER_WORDS.filter(word => 
      lowerMessage.includes(word.toLowerCase())
    );

    if (handoffMatches.length > 0) {
      // 用户主动请求转人工，不标记为敏感，但返回触发词
      return {
        isSensitive: false,
        reason: 'user_handoff_request',
        matchedWords: handoffMatches,
      };
    }

    // 检查敏感词
    const matchedCategories: string[] = [];
    const allMatchedWords: string[] = [];

    for (const [category, words] of Object.entries(SENSITIVE_WORDS)) {
      const matches = words.filter(word => 
        lowerMessage.includes(word.toLowerCase())
      );

      if (matches.length > 0) {
        matchedCategories.push(category);
        allMatchedWords.push(...matches);
      }
    }

    if (allMatchedWords.length > 0) {
      const reason = `检测到敏感内容：${matchedCategories.join(', ')}`;
      logger.info('敏感词检测命中', {
        categories: matchedCategories,
        words: allMatchedWords,
      });

      return {
        isSensitive: true,
        reason,
        matchedWords: allMatchedWords,
      };
    }

    return {
      isSensitive: false,
    };
  }

  /**
   * 添加自定义敏感词
   */
  addCustomWords(category: string, words: string[]): void {
    if (!SENSITIVE_WORDS[category]) {
      SENSITIVE_WORDS[category] = [];
    }
    SENSITIVE_WORDS[category].push(...words);
    logger.info('添加自定义敏感词', { category, count: words.length });
  }

  /**
   * 移除敏感词
   */
  removeCustomWord(category: string, word: string): void {
    if (SENSITIVE_WORDS[category]) {
      SENSITIVE_WORDS[category] = SENSITIVE_WORDS[category].filter(
        w => w !== word
      );
    }
  }

  /**
   * 获取所有敏感词分类
   */
  getCategories(): string[] {
    return Object.keys(SENSITIVE_WORDS);
  }
}

// 单例
export const sensitivityFilterService = new SensitivityFilterService();
