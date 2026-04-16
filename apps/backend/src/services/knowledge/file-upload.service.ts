/**
 * 文件上传服务
 * 支持多文件上传、文件验证、MinIO 存储
 */

import { v4 as uuidv4 } from 'uuid';
import { minioClient, minioConfig, generateStorageKey, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '../../config/minio.config';
import { createBadRequestError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { Readable } from 'stream';

export interface UploadFileResult {
  fileId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface UploadOptions {
  tenantId: string;
  knowledgeBaseId: string;
  allowedTypes?: string[];
  maxSize?: number;
}

/**
 * 验证文件类型
 */
const validateFileType = (mimeType: string, filename: string): boolean => {
  // 检查 MIME 类型
  if (ALLOWED_MIME_TYPES[mimeType as keyof typeof ALLOWED_MIME_TYPES]) {
    return true;
  }

  // 检查扩展名
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    return true;
  }

  return false;
};

/**
 * 验证文件大小
 */
const validateFileSize = (size: number, maxSize: number = MAX_FILE_SIZE): void => {
  if (size > maxSize) {
    throw createBadRequestError(`文件大小超过限制（最大 ${maxSize / 1024 / 1024}MB）`);
  }
};

/**
 * 上传单个文件到 MinIO
 */
export const uploadFileToMinIO = async (
  fileBuffer: Buffer,
  options: UploadOptions
): Promise<UploadFileResult> => {
  const { tenantId, knowledgeBaseId, allowedTypes, maxSize } = options;

  // 生成文件 ID 和存储键
  const fileId = uuidv4();
  const storageKey = generateStorageKey(tenantId, knowledgeBaseId, fileId, 'temp');

  try {
    // 上传到 MinIO
    await minioClient.putObject(
      minioConfig.bucketName,
      storageKey,
      fileBuffer,
      fileBuffer.length
    );

    logger.info('文件上传成功', {
      fileId,
      storageKey,
      size: fileBuffer.length,
    });

    return {
      fileId,
      storageKey,
      originalName: 'temp',
      mimeType: 'application/octet-stream',
      size: fileBuffer.length,
    };
  } catch (error) {
    logger.error('文件上传失败', { error, storageKey });
    throw error;
  }
};

/**
 * 上传文件（带完整验证）
 */
export const uploadDocument = async (
  file: Express.Multer.File,
  options: UploadOptions
): Promise<UploadFileResult> => {
  const { tenantId, knowledgeBaseId } = options;

  // 验证文件是否存在
  if (!file || !file.buffer) {
    throw createBadRequestError('文件为空');
  }

  // 验证文件大小
  validateFileSize(file.size, options.maxSize);

  // 验证文件类型
  if (!validateFileType(file.mimetype, file.originalname)) {
    throw createBadRequestError(
      `不支持的文件类型：${file.mimetype}。仅支持 PDF, DOCX, TXT, MD 格式`
    );
  }

  // 生成文件 ID 和存储键
  const fileId = uuidv4();
  const ext = file.originalname.split('.').pop();
  const filename = `${fileId}.${ext}`;
  const storageKey = generateStorageKey(tenantId, knowledgeBaseId, fileId, filename);

  try {
    // 上传到 MinIO
    await minioClient.putObject(
      minioConfig.bucketName,
      storageKey,
      file.buffer,
      file.size
    );

    logger.info('文档上传成功', {
      fileId,
      storageKey,
      originalName: file.originalname,
      size: file.size,
    });

    return {
      fileId,
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  } catch (error: any) {
    logger.error('文档上传失败', { error, storageKey });
    throw new Error(`文件上传失败：${error.message}`);
  }
};

/**
 * 批量上传文件
 */
export const uploadMultipleDocuments = async (
  files: Express.Multer.File[],
  options: UploadOptions
): Promise<UploadFileResult[]> => {
  const results: UploadFileResult[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    try {
      const result = await uploadDocument(file, options);
      results.push(result);
    } catch (error: any) {
      errors.push({
        filename: file.originalname,
        error: error.message,
      });
    }
  }

  if (errors.length > 0 && results.length === 0) {
    throw createBadRequestError(`所有文件上传失败：${errors.map(e => e.filename).join(', ')}`);
  }

  return results;
};

/**
 * 从 MinIO 下载文件
 */
export const downloadFileFromMinIO = async (storageKey: string): Promise<Buffer> => {
  try {
    const stream = await minioClient.getObject(minioConfig.bucketName, storageKey);
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (error) => {
        logger.error('文件下载失败', { error, storageKey });
        reject(error);
      });
    });
  } catch (error: any) {
    logger.error('文件下载失败', { error, storageKey });
    throw new Error(`文件下载失败：${error.message}`);
  }
};

/**
 * 删除 MinIO 中的文件
 */
export const deleteFileFromMinIO = async (storageKey: string): Promise<void> => {
  try {
    await minioClient.removeObject(minioConfig.bucketName, storageKey);
    logger.info('文件删除成功', { storageKey });
  } catch (error: any) {
    logger.error('文件删除失败', { error, storageKey });
    throw new Error(`文件删除失败：${error.message}`);
  }
};

/**
 * 生成预签名 URL（用于临时访问）
 */
export const getPresignedUrl = async (
  storageKey: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  try {
    const url = await minioClient.presignedGetObject(
      minioConfig.bucketName,
      storageKey,
      expiresInSeconds
    );
    return url;
  } catch (error: any) {
    logger.error('生成预签名 URL 失败', { error, storageKey });
    throw new Error(`生成访问链接失败：${error.message}`);
  }
};
