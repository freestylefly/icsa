/**
 * MinIO 客户端配置
 * 用于文件存储（租户隔离）
 */

import { Client } from 'minio';
import { logger } from '../utils/logger';

export interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
}

// 从环境变量加载配置
const minioConfig: MinIOConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  bucketName: process.env.MINIO_BUCKET_NAME || 'knowledge-base',
};

// 创建 MinIO 客户端实例
export const minioClient = new Client({
  endPoint: minioConfig.endPoint,
  port: minioConfig.port,
  useSSL: minioConfig.useSSL,
  accessKey: minioConfig.accessKey,
  secretKey: minioConfig.secretKey,
});

/**
 * 初始化 MinIO Bucket
 * 确保 bucket 存在，并设置合适的策略
 */
export const initMinIOBucket = async () => {
  try {
    const bucketExists = await minioClient.bucketExists(minioConfig.bucketName);
    
    if (!bucketExists) {
      await minioClient.makeBucket(minioConfig.bucketName);
      logger.info(`MinIO Bucket "${minioConfig.bucketName}" 创建成功`);
    } else {
      logger.info(`MinIO Bucket "${minioConfig.bucketName}" 已存在`);
    }

    // 设置 Bucket 策略（可选：设置为私有，通过预签名 URL 访问）
    // 这里保持默认私有策略，通过后端 API 访问
    logger.info('MinIO 初始化完成');
  } catch (error) {
    logger.error('MinIO 初始化失败', { error });
    throw error;
  }
};

/**
 * 生成租户隔离的存储路径
 * 格式：{tenantId}/{knowledgeBaseId}/{documentId}/{filename}
 */
export const generateStorageKey = (
  tenantId: string,
  knowledgeBaseId: string,
  documentId: string,
  filename: string
): string => {
  // 清理文件名，移除特殊字符
  const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${tenantId}/${knowledgeBaseId}/${documentId}/${cleanFilename}`;
};

/**
 * 允许的文件类型白名单
 */
export const ALLOWED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
};

/**
 * 允许的文件扩展名
 */
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];

/**
 * 最大文件大小（50MB）
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export { minioConfig };
