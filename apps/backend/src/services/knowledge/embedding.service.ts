/**
 * 向量化服务
 * 对接阿里云 Embedding API
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../../utils/logger';

export interface EmbeddingConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  dimensions: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  usage: {
    totalTokens: number;
  };
}

// 默认配置（阿里云 DashScope）
const defaultConfig: EmbeddingConfig = {
  apiKey: process.env.ALIYUN_EMBEDDING_API_KEY || '',
  endpoint: process.env.ALIYUN_EMBEDDING_ENDPOINT || 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/generation',
  model: process.env.ALIYUN_EMBEDDING_MODEL || 'text-embedding-v2',
  dimensions: 1536,
};

/**
 * 批量生成向量嵌入
 * 支持批量处理（10 条/批）和自动重试
 */
export const generateEmbeddings = async (
  texts: string[],
  config: EmbeddingConfig = defaultConfig,
  options?: {
    batchSize?: number;
    maxRetries?: number;
  }
): Promise<EmbeddingResponse> => {
  const { batchSize = 10, maxRetries = 3 } = options || {};
  
  logger.info('开始生成向量嵌入', {
    textCount: texts.length,
    batchSize,
    maxRetries,
  });

  if (texts.length === 0) {
    return { embeddings: [], usage: { totalTokens: 0 } };
  }

  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  // 分批处理
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    let retryCount = 0;
    let success = false;

    while (retryCount < maxRetries && !success) {
      try {
        const response = await callEmbeddingAPI(batch, config);
        
        allEmbeddings.push(...response.embeddings);
        totalTokens += response.usage.totalTokens;
        
        logger.debug(`批次 ${Math.floor(i / batchSize) + 1} 处理成功`, {
          batchSize: batch.length,
          tokens: response.usage.totalTokens,
        });
        
        success = true;
      } catch (error) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          logger.error('向量生成失败（达到最大重试次数）', {
            error,
            retryCount,
            batchIndex: Math.floor(i / batchSize),
          });
          throw error;
        }

        // 指数退避
        const delay = Math.pow(2, retryCount) * 1000;
        logger.warn(`向量生成失败，${delay / 1000}秒后重试`, {
          error,
          retryCount,
        });
        
        await sleep(delay);
      }
    }

    // 避免请求过快
    if (i + batchSize < texts.length) {
      await sleep(100);
    }
  }

  logger.info('向量嵌入生成完成', {
    totalEmbeddings: allEmbeddings.length,
    totalTokens,
  });

  return {
    embeddings: allEmbeddings,
    usage: { totalTokens },
  };
};

/**
 * 调用阿里云 Embedding API
 */
const callEmbeddingAPI = async (
  texts: string[],
  config: EmbeddingConfig
): Promise<EmbeddingResponse> => {
  try {
    const response = await axios.post(
      config.endpoint,
      {
        model: config.model,
        input: texts,
        parameters: {
          text_type: 'query', // 或 'passage'
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 秒超时
      }
    );

    // 阿里云 DashScope 响应格式
    const apiResponse = response.data as any;
    
    if (apiResponse.code) {
      throw new Error(`API 错误：${apiResponse.message || apiResponse.code}`);
    }

    const embeddings = apiResponse.output?.embeddings?.map((e: any) => e.embedding) || [];
    const usage = apiResponse.usage || { total_tokens: 0 };

    return {
      embeddings,
      usage: {
        totalTokens: usage.total_tokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      logger.error('阿里云 Embedding API 调用失败', {
        status: error.response?.status,
        message: error.message,
      });
      
      if (error.response?.status === 401) {
        throw new Error('API Key 无效或已过期');
      } else if (error.response?.status === 429) {
        throw new Error('API 请求频率超限，请稍后重试');
      } else if (error.response?.status === 500) {
        throw new Error('API 服务内部错误');
      }
    }
    
    throw error;
  }
};

/**
 * 生成单个文本的向量
 */
export const generateSingleEmbedding = async (
  text: string,
  config?: EmbeddingConfig
): Promise<number[]> => {
  const response = await generateEmbeddings([text], config);
  return response.embeddings[0];
};

/**
 * 计算余弦相似度
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * 延迟函数
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 验证向量维度
 */
export const validateEmbedding = (embedding: number[], expectedDimensions: number = 1536): boolean => {
  return Array.isArray(embedding) && embedding.length === expectedDimensions;
};

export { defaultConfig };
