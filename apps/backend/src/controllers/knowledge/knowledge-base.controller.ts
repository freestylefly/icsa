/**
 * 知识库管理控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as kbService from '../../services/knowledge/knowledge-base.service';
import { getTenantBySlug } from '../../services/tenant.service';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { generateEmbeddings } from '../../services/knowledge/embedding.service';
import { vectorSearch, hybridSearch } from '../../services/knowledge/vector-store.service';

/**
 * 创建知识库
 * POST /api/knowledge-bases
 */
export const createKnowledgeBase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new AppError('租户 ID 不能为空', 400);
    }

    const { name, description, settings } = req.body;

    if (!name) {
      throw new AppError('知识库名称不能为空', 400);
    }

    const knowledgeBase = await kbService.createKnowledgeBase({
      tenantId,
      name,
      description,
      settings,
    });

    res.status(201).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取知识库列表
 * GET /api/knowledge-bases
 */
export const getKnowledgeBases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as any || undefined;

    if (!tenantId) {
      throw new AppError('租户 ID 不能为空', 400);
    }

    const result = await kbService.getKnowledgeBases({
      tenantId,
      page,
      limit,
      status,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取知识库详情
 * GET /api/knowledge-bases/:id
 */
export const getKnowledgeBaseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    const knowledgeBase = await kbService.getKnowledgeBaseById(id, tenantId || undefined);

    res.json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新知识库
 * PUT /api/knowledge-bases/:id
 */
export const updateKnowledgeBase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, status, settings } = req.body;

    const knowledgeBase = await kbService.updateKnowledgeBase(id, {
      name,
      description,
      status,
      settings,
    });

    res.json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除知识库
 * DELETE /api/knowledge-bases/:id
 */
export const deleteKnowledgeBase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await kbService.deleteKnowledgeBase(id);

    res.json({
      success: true,
      message: '知识库已删除',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 上传文档
 * POST /api/knowledge-bases/:id/documents
 */
export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new AppError('租户 ID 不能为空', 400);
    }

    if (!req.file) {
      throw new AppError('请选择要上传的文件', 400);
    }

    const document = await kbService.uploadDocumentToKB({
      knowledgeBaseId: id,
      tenantId,
      file: req.file,
    });

    res.status(201).json({
      success: true,
      data: document,
      message: '文档上传成功，正在后台处理',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 批量上传文档
 * POST /api/knowledge-bases/:id/documents/batch
 */
export const uploadMultipleDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      throw new AppError('租户 ID 不能为空', 400);
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError('请选择要上传的文件', 400);
    }

    const results = [];
    for (const file of files) {
      try {
        const document = await kbService.uploadDocumentToKB({
          knowledgeBaseId: id,
          tenantId,
          file,
        });
        results.push({
          success: true,
          data: document,
        });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          filename: file.originalname,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      message: `批量上传完成，成功 ${results.filter(r => r.success).length}/${results.length}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取文档列表
 * GET /api/knowledge-bases/:kbId/documents
 */
export const getDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as any || undefined;

    const result = await kbService.getDocuments({
      knowledgeBaseId: kbId,
      page,
      limit,
      status,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取文档详情
 * GET /api/knowledge-bases/:kbId/documents/:docId
 */
export const getDocumentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId, docId } = req.params;

    const document = await kbService.getDocumentById(docId, kbId);

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除文档
 * DELETE /api/knowledge-bases/:kbId/documents/:docId
 */
export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { docId } = req.params;

    await kbService.deleteDocument(docId);

    res.json({
      success: true,
      message: '文档已删除',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取知识片段列表
 * GET /api/knowledge-bases/:kbId/chunks
 */
export const getChunks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params;
    const documentId = req.query.documentId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await kbService.getChunks({
      knowledgeBaseId: kbId,
      documentId,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 创建问答对
 * POST /api/knowledge-bases/:kbId/qa-pairs
 */
export const createQAPair = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params;
    const { question, answer, answerVariants, category, tags, priority } = req.body;

    if (!question || !answer) {
      throw new AppError('问题和答案为必填项', 400);
    }

    const qaPair = await kbService.createQAPair({
      knowledgeBaseId: kbId,
      question,
      answer,
      answerVariants,
      category,
      tags,
      priority,
    });

    res.status(201).json({
      success: true,
      data: qaPair,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新问答对
 * PUT /api/knowledge-bases/qa-pairs/:id
 */
export const updateQAPair = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const qaPair = await kbService.updateQAPair(id, updateData);

    res.json({
      success: true,
      data: qaPair,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 删除问答对
 * DELETE /api/knowledge-bases/qa-pairs/:id
 */
export const deleteQAPair = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await kbService.deleteQAPair(id);

    res.json({
      success: true,
      message: '问答对已删除',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取问答对列表
 * GET /api/knowledge-bases/:kbId/qa-pairs
 */
export const getQAPairs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string | undefined;
    const status = req.query.status as any || undefined;

    const result = await kbService.getQAPairs({
      knowledgeBaseId: kbId,
      page,
      limit,
      category,
      status,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 知识检索（向量搜索）
 * POST /api/knowledge-bases/:kbId/search
 */
export const searchKnowledge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kbId } = req.params;
    const { query, topK = 5, minSimilarity = 0, useHybrid = false } = req.body;

    if (!query) {
      throw new AppError('查询内容不能为空', 400);
    }

    let results;

    if (useHybrid) {
      // 混合检索
      const queryEmbedding = await generateEmbeddings([query]);
      results = await hybridSearch(queryEmbedding.embeddings[0], query, {
        topK,
        minSimilarity,
        filter: { knowledgeBaseId: kbId },
      });
    } else {
      // 纯向量检索
      const queryEmbedding = await generateEmbeddings([query]);
      results = await vectorSearch(queryEmbedding.embeddings[0], {
        topK,
        minSimilarity,
        filter: { knowledgeBaseId: kbId },
      });
    }

    res.json({
      success: true,
      data: results,
      meta: {
        query,
        resultCount: results.length,
        topK,
      },
    });
  } catch (error) {
    next(error);
  }
};
