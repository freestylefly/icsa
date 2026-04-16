/**
 * 知识库管理路由
 * Phase 2 完整实现
 */

import { Router } from 'express';
import multer from 'multer';
import * as kbController from '../controllers/knowledge/knowledge-base.controller';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '../config/minio.config';
import { logger } from '../utils/logger';

const router = Router();

// 配置 Multer（内存存储，用于上传到 MinIO）
const storage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES[file.mimetype as keyof typeof ALLOWED_MIME_TYPES]) {
    callback(null, true);
  } else {
    const error = new Error(`不支持的文件类型：${file.mimetype}`);
    (error as any).code = 'UNSUPPORTED_MEDIA_TYPE';
    callback(error);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// ==================== 知识库管理 ====================

/**
 * 创建知识库
 * POST /api/knowledge-bases
 */
router.post('/', kbController.createKnowledgeBase);

/**
 * 获取知识库列表
 * GET /api/knowledge-bases
 */
router.get('/', kbController.getKnowledgeBases);

/**
 * 获取知识库详情
 * GET /api/knowledge-bases/:id
 */
router.get('/:id', kbController.getKnowledgeBaseById);

/**
 * 更新知识库
 * PUT /api/knowledge-bases/:id
 */
router.put('/:id', kbController.updateKnowledgeBase);

/**
 * 删除知识库
 * DELETE /api/knowledge-bases/:id
 */
router.delete('/:id', kbController.deleteKnowledgeBase);

// ==================== 文档管理 ====================

/**
 * 上传单个文档
 * POST /api/knowledge-bases/:id/documents
 */
router.post('/:id/documents', upload.single('file'), kbController.uploadDocument);

/**
 * 批量上传文档
 * POST /api/knowledge-bases/:id/documents/batch
 */
router.post('/:id/documents/batch', upload.array('files', 10), kbController.uploadMultipleDocuments);

/**
 * 获取文档列表
 * GET /api/knowledge-bases/:kbId/documents
 */
router.get('/:kbId/documents', kbController.getDocuments);

/**
 * 获取文档详情
 * GET /api/knowledge-bases/:kbId/documents/:docId
 */
router.get('/:kbId/documents/:docId', kbController.getDocumentById);

/**
 * 删除文档
 * DELETE /api/knowledge-bases/:kbId/documents/:docId
 */
router.delete('/:kbId/documents/:docId', kbController.deleteDocument);

// ==================== 知识片段管理 ====================

/**
 * 获取知识片段列表
 * GET /api/knowledge-bases/:kbId/chunks
 */
router.get('/:kbId/chunks', kbController.getChunks);

// ==================== 问答对管理 ====================

/**
 * 创建问答对
 * POST /api/knowledge-bases/:kbId/qa-pairs
 */
router.post('/:kbId/qa-pairs', kbController.createQAPair);

/**
 * 更新问答对
 * PUT /api/knowledge-bases/qa-pairs/:id
 */
router.put('/qa-pairs/:id', kbController.updateQAPair);

/**
 * 删除问答对
 * DELETE /api/knowledge-bases/qa-pairs/:id
 */
router.delete('/qa-pairs/:id', kbController.deleteQAPair);

/**
 * 获取问答对列表
 * GET /api/knowledge-bases/:kbId/qa-pairs
 */
router.get('/:kbId/qa-pairs', kbController.getQAPairs);

// ==================== 知识检索 ====================

/**
 * 知识检索（向量搜索）
 * POST /api/knowledge-bases/:kbId/search
 */
router.post('/:kbId/search', kbController.searchKnowledge);

// ==================== 错误处理 ====================

// Multer 错误处理
router.use((err: any, req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`,
      });
    }
    if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    return res.status(400).json({
      success: false,
      error: `上传错误：${err.message}`,
    });
  }
  next(err);
});

logger.info('知识库路由已加载');

export { router as knowledgeBaseRoutes };
