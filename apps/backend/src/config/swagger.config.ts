/**
 * Swagger API 文档配置
 */

import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '智能客服平台 API',
      version: '2.0.0',
      description: `
# 智能客服平台 - 知识库模块 API 文档

## Phase 2 功能模块

### 1. MinIO 文件上传服务
- 支持多文件上传
- 文件类型验证（PDF/DOCX/TXT/MD）
- 文件大小限制（最大 50MB）
- 租户隔离存储

### 2. 文档解析器
- PDF 解析（pdf-parse）
- Word 解析（mammoth）
- TXT/MD 直接读取
- 异步解析任务队列（BullMQ）

### 3. 知识切分模块
- 按段落/标题切分
- 重叠窗口策略（overlap 200 chars）
- 切分长度控制（每段 500-1000 chars）

### 4. 向量化服务
- 阿里云 Embedding API
- 批量处理（10 条/批）
- 自动重试机制

### 5. 知识检索接口
- 向量相似度搜索
- 混合检索（向量 + 关键词）
- Top-K 召回

### 6. 知识库管理后台
- 文档 CRUD
- 知识片段预览
- 问答对管理

## 认证说明
所有请求需要在 Header 中包含：
- \`x-tenant-id\`: 租户 ID

## 基础 URL
\`\`\`
http://localhost:3001/api
\`\`\`
      `,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: '开发环境',
      },
      {
        url: 'https://api.example.com/api',
        description: '生产环境',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        tenantAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-tenant-id',
        },
      },
      schemas: {
        KnowledgeBase: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DELETED'] },
            settings: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            knowledgeBaseId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            originalName: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'integer' },
            storageKey: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
            parsedAt: { type: 'string', format: 'date-time', nullable: true },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        KnowledgeChunk: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            knowledgeBaseId: { type: 'string', format: 'uuid' },
            documentId: { type: 'string', format: 'uuid', nullable: true },
            content: { type: 'string' },
            metadata: { type: 'object' },
            embedding: { type: 'array', items: { type: 'number' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        QAPair: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            knowledgeBaseId: { type: 'string', format: 'uuid' },
            question: { type: 'string' },
            answer: { type: 'string' },
            answerVariants: { type: 'array', items: { type: 'string' } },
            category: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            priority: { type: 'integer' },
            status: { type: 'string', enum: ['ACTIVE', 'DRAFT', 'ARCHIVED', 'DELETED'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            chunkId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            metadata: { type: 'object' },
            similarity: { type: 'number', format: 'float' },
            documentId: { type: 'string', format: 'uuid', nullable: true },
            documentName: { type: 'string', nullable: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'KnowledgeBase', description: '知识库管理' },
      { name: 'Document', description: '文档管理' },
      { name: 'Chunk', description: '知识片段管理' },
      { name: 'QAPair', description: '问答对管理' },
      { name: 'Search', description: '知识检索' },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
