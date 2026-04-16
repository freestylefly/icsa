/**
 * 文档处理队列（BullMQ）
 * 异步处理文档解析、向量化任务
 */

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { parseDocument } from '../services/knowledge/document-parser.service';
import { chunkDocument } from '../services/knowledge/chunking.service';
import { generateEmbeddings } from '../services/knowledge/embedding.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Redis 连接配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // BullMQ 推荐设置
};

const redisConnection = new Redis(redisConfig);

// 队列名称
const DOCUMENT_PROCESSING_QUEUE = 'document:processing';

/**
 * 文档处理任务数据
 */
export interface DocumentProcessingJob {
  documentId: string;
  tenantId: string;
  knowledgeBaseId: string;
  storageKey: string;
  mimeType: string;
  filename: string;
}

/**
 * 创建文档处理队列
 */
export const documentQueue = new Queue(DOCUMENT_PROCESSING_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // 失败重试 3 次
    backoff: {
      type: 'exponential',
      delay: 2000, // 初始延迟 2 秒
    },
    removeOnComplete: {
      age: 3600, // 保留 1 小时
    },
    removeOnFail: {
      age: 24 * 3600, // 失败任务保留 24 小时
    },
  },
});

/**
 * 添加文档处理任务到队列
 */
export const addDocumentProcessingJob = async (jobData: DocumentProcessingJob): Promise<Job> => {
  const job = await documentQueue.add('process-document', jobData, {
    jobId: jobData.documentId,
  });

  logger.info('文档处理任务已加入队列', {
    jobId: job.id,
    documentId: jobData.documentId,
  });

  return job;
};

/**
 * 创建文档处理 Worker
 */
export const createDocumentWorker = () => {
  const worker = new Worker(
    DOCUMENT_PROCESSING_QUEUE,
    async (job: Job<DocumentProcessingJob>) => {
      const { documentId, tenantId, knowledgeBaseId, storageKey, mimeType, filename } = job.data;

      logger.info('开始处理文档', { documentId, filename });

      try {
        // 更新文档状态为处理中
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'PROCESSING' },
        });

        // 步骤 1: 解析文档
        logger.info('解析文档', { documentId });
        const parsedDoc = await parseDocument(storageKey, mimeType, filename);

        // 步骤 2: 切分文档
        logger.info('切分文档', { documentId });
        const chunks = chunkDocument(parsedDoc, {
          chunkSize: 800,
          overlap: 200,
        });

        // 步骤 3: 生成向量嵌入
        logger.info('生成向量嵌入', { documentId, chunkCount: chunks.length });
        const texts = chunks.map(chunk => chunk.content);
        const embeddingResponse = await generateEmbeddings(texts, undefined, {
          batchSize: 10,
          maxRetries: 3,
        });

        // 步骤 4: 保存到数据库
        logger.info('保存知识片段', { documentId, chunkCount: chunks.length });
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddingResponse.embeddings[i];

          await prisma.knowledgeChunk.create({
            data: {
              knowledgeBaseId,
              documentId,
              content: chunk.content,
              metadata: {
                ...chunk.metadata,
                pageNumber: chunk.metadata.pageNumber,
                title: chunk.metadata.title,
              },
              embedding: new PrismaClient().$extends({
                query: {
                  knowledgeChunk: {
                    create: {
                      // pgvector 处理
                    },
                  },
                },
              }),
            },
          });
        }

        // 更新文档状态为完成
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'COMPLETED',
            parsedAt: new Date(),
            metadata: {
              wordCount: parsedDoc.metadata.wordCount,
              pageCount: parsedDoc.pages?.length,
              chunkCount: chunks.length,
            },
          },
        });

        logger.info('文档处理完成', {
          documentId,
          chunkCount: chunks.length,
          tokens: embeddingResponse.usage.totalTokens,
        });

        return {
          success: true,
          chunkCount: chunks.length,
          tokens: embeddingResponse.usage.totalTokens,
        };
      } catch (error: any) {
        logger.error('文档处理失败', { documentId, error });

        // 更新文档状态为失败
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: 'FAILED',
            metadata: {
              errorMessage: error.message,
            },
          },
        });

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2, // 并发处理 2 个任务
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('任务完成', { jobId: job.id, result });
  });

  worker.on('failed', (job, error) => {
    logger.error('任务失败', { jobId: job?.id, error });
  });

  worker.on('error', (error) => {
    logger.error('Worker 错误', { error });
  });

  logger.info('文档处理 Worker 已启动');

  return worker;
};

/**
 * 获取队列状态
 */
export const getQueueStatus = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    documentQueue.getWaiting(),
    documentQueue.getActive(),
    documentQueue.getCompleted(),
    documentQueue.getFailed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
};

/**
 * 清空队列
 */
export const clearQueue = async () => {
  await documentQueue.obliterate({ force: true });
  logger.info('队列已清空');
};

/**
 * 关闭队列连接
 */
export const closeQueue = async () => {
  await documentQueue.close();
  await redisConnection.quit();
  logger.info('队列连接已关闭');
};
