/**
 * LLM 配置（阿里云通义千问 Qwen-Max）
 */

import dotenv from 'dotenv';
dotenv.config();

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export const llmConfig: LLMConfig = {
  apiKey: process.env.QWEN_API_KEY || '',
  baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
  model: process.env.QWEN_MODEL || 'qwen-max',
  maxTokens: parseInt(process.env.QWEN_MAX_TOKENS || '2048', 10),
  temperature: parseFloat(process.env.QWEN_TEMPERATURE || '0.7'),
  timeout: parseInt(process.env.QWEN_TIMEOUT || '30000', 10),
};

// 意图识别专用配置
export const intentConfig = {
  model: process.env.QWEN_INTENT_MODEL || 'qwen-max',
  maxTokens: 500,
  temperature: 0.1, // 低温度，保证输出稳定
};

// RAG 回答生成专用配置
export const ragConfig = {
  model: process.env.QWEN_RAG_MODEL || 'qwen-max',
  maxTokens: 2048,
  temperature: 0.7,
  stream: true,
};

// 验证配置
export const validateLLMConfig = (): boolean => {
  if (!llmConfig.apiKey) {
    console.error('❌ 缺少 QWEN_API_KEY 环境变量');
    return false;
  }
  return true;
};
