/**
 * 向量存储服务
 * 使用 Prisma + pgvector 存储和检索向量
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export interface VectorSearchOptions {
  /** 返回结果数量 */
  topK?: number;
  /** 最小相似度阈值 */
  minSimilarity?: number;
  /** 过滤条件（文档 ID、知识库 ID 等） */
  filter?: {
    documentId?: string;
    knowledgeBaseId?: string;
  };
}

export interface SearchResult {
  chunkId: string;
  content: string;
  metadata: any;
  similarity: number;
  documentId?: string;
  documentName?: string;
}

/**
 * 保存向量嵌入到数据库
 * 使用 Prisma 原始查询支持 pgvector
 */
export const saveEmbeddings = async (
  chunks: Array<{
    knowledgeBaseId: string;
    documentId?: string;
    content: string;
    metadata?: any;
    embedding: number[];
  }>
): Promise<number> => {
  let savedCount = 0;

  for (const chunk of chunks) {
    try {
      // 使用 $executeRaw 插入向量
      await prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" (
          id,
          "knowledgeBaseId",
          "documentId",
          content,
          metadata,
          embedding,
          "createdAt",
          "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${chunk.knowledgeBaseId},
          ${chunk.documentId},
          ${chunk.content},
          ${JSON.stringify(chunk.metadata || {})}::jsonb,
          ${chunk.embedding}::vector(1536),
          NOW(),
          NOW()
        )
      `;
      
      savedCount++;
    } catch (error: any) {
      logger.error('保存向量失败', { error, chunk });
      // 继续处理其他片段
    }
  }

  logger.info('向量保存完成', { savedCount, total: chunks.length });
  
  return savedCount;
};

/**
 * 向量相似度搜索
 * 使用 pgvector 的余弦相似度
 */
export const vectorSearch = async (
  queryEmbedding: number[],
  options: VectorSearchOptions = {}
): Promise<SearchResult[]> => {
  const {
    topK = 5,
    minSimilarity = 0,
    filter,
  } = options;

  // 构建 WHERE 条件
  let whereClause = '';
  const params: any[] = [queryEmbedding, topK];
  let paramIndex = 3;

  if (filter?.knowledgeBaseId) {
    whereClause += ` AND "knowledgeBaseId" = $${paramIndex}`;
    params.push(filter.knowledgeBaseId);
    paramIndex++;
  }

  if (filter?.documentId) {
    whereClause += ` AND "documentId" = $${paramIndex}`;
    params.push(filter.documentId);
    paramIndex++;
  }

  try {
    // 使用 pgvector 的余弦相似度操作符 (<=>)
    const results = await prisma.$queryRaw`
      SELECT 
        kc.id as "chunkId",
        kc.content,
        kc.metadata,
        kc."documentId",
        1 - (kc.embedding <=> ${queryEmbedding}::vector(1536)) as similarity,
        d.name as "documentName"
      FROM "KnowledgeChunk" kc
      LEFT JOIN "Document" d ON kc."documentId" = d.id
      WHERE 1 = 1 ${whereClause}
      ORDER BY kc.embedding <=> ${queryEmbedding}::vector(1536)
      LIMIT ${topK}
    `;

    // 过滤低于阈值的結果
    const filteredResults = (results as any[]).filter(r => r.similarity >= minSimilarity);

    logger.info('向量搜索完成', {
      resultsCount: filteredResults.length,
      topK,
      minSimilarity,
    });

    return filteredResults.map(r => ({
      chunkId: r.chunkId,
      content: r.content,
      metadata: r.metadata,
      similarity: r.similarity,
      documentId: r.documentId,
      documentName: r.documentName,
    }));
  } catch (error: any) {
    logger.error('向量搜索失败', { error });
    throw new Error(`向量搜索失败：${error.message}`);
  }
};

/**
 * 混合检索（向量 + 关键词）
 * 结合向量相似度和文本匹配
 */
export const hybridSearch = async (
  queryEmbedding: number[],
  queryText: string,
  options: VectorSearchOptions = {}
): Promise<SearchResult[]> => {
  const {
    topK = 5,
    minSimilarity = 0,
    filter,
  } = options;

  // 构建 WHERE 条件
  let whereClause = '';
  const params: any[] = [queryEmbedding];
  let paramIndex = 2;

  if (filter?.knowledgeBaseId) {
    whereClause += ` AND "knowledgeBaseId" = $${paramIndex}`;
    params.push(filter.knowledgeBaseId);
    paramIndex++;
  }

  if (filter?.documentId) {
    whereClause += ` AND "documentId" = $${paramIndex}`;
    params.push(filter.documentId);
    paramIndex++;
  }

  try {
    // 向量相似度 + 文本匹配的混合检索
    // 使用 ILIKE 进行关键词匹配，增加相关性分数
    const results = await prisma.$queryRaw`
      SELECT 
        kc.id as "chunkId",
        kc.content,
        kc.metadata,
        kc."documentId",
        1 - (kc.embedding <=> ${queryEmbedding}::vector(1536)) as vector_similarity,
        CASE 
          WHEN kc.content ILIKE ${`%${queryText}%`} THEN 0.3
          ELSE 0
        END as keyword_score,
        d.name as "documentName"
      FROM "KnowledgeChunk" kc
      LEFT JOIN "Document" d ON kc."documentId" = d.id
      WHERE 1 = 1 ${whereClause}
      ORDER BY 
        (1 - (kc.embedding <=> ${queryEmbedding}::vector(1536))) * 0.8 +
        CASE 
          WHEN kc.content ILIKE ${`%${queryText}%`} THEN 0.3
          ELSE 0
        END DESC
      LIMIT ${topK * 2}
    `;

    // 计算综合得分并过滤
    const processedResults = (results as any[]).map(r => ({
      chunkId: r.chunkId,
      content: r.content,
      metadata: r.metadata,
      similarity: r.vector_similarity * 0.8 + r.keyword_score,
      documentId: r.documentId,
      documentName: r.documentName,
    }));

    const filteredResults = processedResults.filter(r => r.similarity >= minSimilarity);

    // 取 topK
    const topResults = filteredResults.slice(0, topK);

    logger.info('混合检索完成', {
      resultsCount: topResults.length,
      topK,
    });

    return topResults;
  } catch (error: any) {
    logger.error('混合检索失败', { error });
    throw new Error(`混合检索失败：${error.message}`);
  }
};

/**
 * 删除文档的所有向量
 */
export const deleteDocumentEmbeddings = async (documentId: string): Promise<number> => {
  const result = await prisma.$executeRaw`
    DELETE FROM "KnowledgeChunk"
    WHERE "documentId" = ${documentId}
  `;

  logger.info('删除文档向量', { documentId, deletedCount: result });
  
  return Number(result);
};

/**
 * 删除知识库的所有向量
 */
export const deleteKnowledgeBaseEmbeddings = async (knowledgeBaseId: string): Promise<number> => {
  const result = await prisma.$executeRaw`
    DELETE FROM "KnowledgeChunk"
    WHERE "knowledgeBaseId" = ${knowledgeBaseId}
  `;

  logger.info('删除知识库向量', { knowledgeBaseId, deletedCount: result });
  
  return Number(result);
};

/**
 * 获取知识库统计信息
 */
export const getKnowledgeBaseStats = async (knowledgeBaseId: string) => {
  const stats = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as "totalChunks",
      COUNT(DISTINCT "documentId") as "totalDocuments",
      AVG(LENGTH(content)) as "avgChunkLength"
    FROM "KnowledgeChunk"
    WHERE "knowledgeBaseId" = ${knowledgeBaseId}
  `;

  return stats[0] as any;
};
