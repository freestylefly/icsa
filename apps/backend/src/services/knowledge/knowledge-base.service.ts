/**
 * 知识库管理服务
 */

import { PrismaClient, KnowledgeBaseStatus, DocumentStatus } from '@prisma/client';
import { createNotFoundError, createBadRequestError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { uploadDocument, deleteFileFromMinIO } from './file-upload.service';
import { addDocumentProcessingJob } from '../../queues/document-queue';

const prisma = new PrismaClient();

export interface CreateKnowledgeBaseDto {
  tenantId: string;
  name: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface UpdateKnowledgeBaseDto {
  name?: string;
  description?: string;
  status?: KnowledgeBaseStatus;
  settings?: Record<string, any>;
}

export interface UploadDocumentDto {
  knowledgeBaseId: string;
  tenantId: string;
  file: Express.Multer.File;
}

/**
 * 创建知识库
 */
export const createKnowledgeBase = async (data: CreateKnowledgeBaseDto) => {
  const knowledgeBase = await prisma.knowledgeBase.create({
    data: {
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      settings: data.settings || {},
    },
  });

  logger.info('知识库创建成功', {
    knowledgeBaseId: knowledgeBase.id,
    name: knowledgeBase.name,
  });

  return knowledgeBase;
};

/**
 * 获取知识库列表
 */
export const getKnowledgeBases = async (options: {
  tenantId: string;
  page?: number;
  limit?: number;
  status?: KnowledgeBaseStatus;
}) => {
  const { tenantId, page = 1, limit = 20, status } = options;

  const where: any = { tenantId };
  if (status) {
    where.status = status;
  }

  const [knowledgeBases, total] = await Promise.all([
    prisma.knowledgeBase.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            documents: true,
            chunks: true,
            qaPairs: true,
          },
        },
      },
    }),
    prisma.knowledgeBase.count({ where }),
  ]);

  return {
    data: knowledgeBases,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取知识库详情
 */
export const getKnowledgeBaseById = async (id: string, tenantId?: string) => {
  const where: any = { id };
  if (tenantId) {
    where.tenantId = tenantId;
  }

  const knowledgeBase = await prisma.knowledgeBase.findUnique({
    where,
    include: {
      _count: {
        select: {
          documents: true,
          chunks: true,
          qaPairs: true,
        },
      },
      documents: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!knowledgeBase) {
    throw createNotFoundError('知识库不存在');
  }

  return knowledgeBase;
};

/**
 * 更新知识库
 */
export const updateKnowledgeBase = async (id: string, data: UpdateKnowledgeBaseDto) => {
  const existing = await prisma.knowledgeBase.findUnique({ where: { id } });
  if (!existing) {
    throw createNotFoundError('知识库不存在');
  }

  const knowledgeBase = await prisma.knowledgeBase.update({
    where: { id },
    data,
  });

  logger.info('知识库更新成功', { knowledgeBaseId: id });

  return knowledgeBase;
};

/**
 * 删除知识库（软删除）
 */
export const deleteKnowledgeBase = async (id: string) => {
  const existing = await prisma.knowledgeBase.findUnique({ where: { id } });
  if (!existing) {
    throw createNotFoundError('知识库不存在');
  }

  // 软删除
  const knowledgeBase = await prisma.knowledgeBase.update({
    where: { id },
    data: { status: KnowledgeBaseStatus.DELETED },
  });

  logger.info('知识库已删除', { knowledgeBaseId: id });

  return knowledgeBase;
};

/**
 * 上传文档到知识库
 */
export const uploadDocumentToKB = async (data: UploadDocumentDto) => {
  const { knowledgeBaseId, tenantId, file } = data;

  // 验证知识库存在
  const knowledgeBase = await prisma.knowledgeBase.findFirst({
    where: { id: knowledgeBaseId, tenantId },
  });

  if (!knowledgeBase) {
    throw createNotFoundError('知识库不存在');
  }

  // 上传文件到 MinIO
  const uploadResult = await uploadDocument(file, {
    tenantId,
    knowledgeBaseId,
  });

  // 创建文档记录
  const document = await prisma.document.create({
    data: {
      knowledgeBaseId,
      name: uploadResult.fileId,
      originalName: uploadResult.originalName,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      storageKey: uploadResult.storageKey,
      status: DocumentStatus.PENDING,
      metadata: {},
    },
  });

  logger.info('文档上传成功', {
    documentId: document.id,
    knowledgeBaseId,
  });

  // 添加到处理队列
  try {
    await addDocumentProcessingJob({
      documentId: document.id,
      tenantId,
      knowledgeBaseId,
      storageKey: uploadResult.storageKey,
      mimeType: uploadResult.mimeType,
      filename: uploadResult.originalName,
    });
  } catch (error: any) {
    logger.error('加入处理队列失败', { error, documentId: document.id });
    // 不阻止上传成功
  }

  return document;
};

/**
 * 获取文档列表
 */
export const getDocuments = async (options: {
  knowledgeBaseId: string;
  page?: number;
  limit?: number;
  status?: DocumentStatus;
}) => {
  const { knowledgeBaseId, page = 1, limit = 20, status } = options;

  const where: any = { knowledgeBaseId };
  if (status) {
    where.status = status;
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    data: documents,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 获取文档详情
 */
export const getDocumentById = async (documentId: string, knowledgeBaseId?: string) => {
  const where: any = { id: documentId };
  if (knowledgeBaseId) {
    where.knowledgeBaseId = knowledgeBaseId;
  }

  const document = await prisma.document.findUnique({
    where,
    include: {
      chunks: {
        take: 10,
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!document) {
    throw createNotFoundError('文档不存在');
  }

  return document;
};

/**
 * 删除文档
 */
export const deleteDocument = async (documentId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw createNotFoundError('文档不存在');
  }

  // 删除 MinIO 中的文件
  try {
    await deleteFileFromMinIO(document.storageKey);
  } catch (error: any) {
    logger.warn('删除 MinIO 文件失败', { error, storageKey: document.storageKey });
  }

  // 删除数据库记录（级联删除 chunks）
  await prisma.document.delete({
    where: { id: documentId },
  });

  logger.info('文档已删除', { documentId });

  return { success: true };
};

/**
 * 获取知识片段列表
 */
export const getChunks = async (options: {
  documentId?: string;
  knowledgeBaseId?: string;
  page?: number;
  limit?: number;
}) => {
  const { documentId, knowledgeBaseId, page = 1, limit = 50 } = options;

  const where: any = {};
  if (documentId) {
    where.documentId = documentId;
  }
  if (knowledgeBaseId) {
    where.knowledgeBaseId = knowledgeBaseId;
  }

  const [chunks, total] = await Promise.all([
    prisma.knowledgeChunk.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.knowledgeChunk.count({ where }),
  ]);

  return {
    data: chunks,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * 创建问答对
 */
export const createQAPair = async (data: {
  knowledgeBaseId: string;
  question: string;
  answer: string;
  answerVariants?: string[];
  category?: string;
  tags?: string[];
  priority?: number;
}) => {
  const qaPair = await prisma.qAPair.create({
    data: {
      knowledgeBaseId: data.knowledgeBaseId,
      question: data.question,
      answer: data.answer,
      answerVariants: data.answerVariants || [],
      category: data.category,
      tags: data.tags || [],
      priority: data.priority || 0,
    },
  });

  logger.info('问答对创建成功', { qaPairId: qaPair.id });

  return qaPair;
};

/**
 * 更新问答对
 */
export const updateQAPair = async (id: string, data: Partial<typeof createQAPair>) => {
  const existing = await prisma.qAPair.findUnique({ where: { id } });
  if (!existing) {
    throw createNotFoundError('问答对不存在');
  }

  const qaPair = await prisma.qAPair.update({
    where: { id },
    data,
  });

  logger.info('问答对更新成功', { qaPairId: id });

  return qaPair;
};

/**
 * 删除问答对
 */
export const deleteQAPair = async (id: string) => {
  const existing = await prisma.qAPair.findUnique({ where: { id } });
  if (!existing) {
    throw createNotFoundError('问答对不存在');
  }

  await prisma.qAPair.delete({ where: { id } });

  logger.info('问答对已删除', { qaPairId: id });

  return { success: true };
};

/**
 * 获取问答对列表
 */
export const getQAPairs = async (options: {
  knowledgeBaseId: string;
  page?: number;
  limit?: number;
  category?: string;
  status?: any;
}) => {
  const { knowledgeBaseId, page = 1, limit = 20, category, status } = options;

  const where: any = { knowledgeBaseId };
  if (category) {
    where.category = category;
  }
  if (status) {
    where.status = status;
  }

  const [qaPairs, total] = await Promise.all([
    prisma.qAPair.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { priority: 'desc' },
    }),
    prisma.qAPair.count({ where }),
  ]);

  return {
    data: qaPairs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
