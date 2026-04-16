# Phase 2：知识库模块 - 启动和测试说明

## 📁 目录结构变更

```
apps/backend/
├── src/
│   ├── config/
│   │   ├── minio.config.ts          # MinIO 客户端配置
│   │   └── swagger.config.ts        # Swagger API 文档配置
│   ├── services/
│   │   └── knowledge/
│   │       ├── file-upload.service.ts    # 文件上传服务
│   │       ├── document-parser.service.ts # 文档解析服务
│   │       ├── chunking.service.ts       # 知识切分服务
│   │       ├── embedding.service.ts      # 向量化服务
│   │       ├── vector-store.service.ts   # 向量存储服务
│   │       └── knowledge-base.service.ts # 知识库管理服务
│   ├── controllers/
│   │   └── knowledge/
│   │       └── knowledge-base.controller.ts # 知识库控制器
│   ├── routes/
│   │   └── knowledgeBase.routes.ts    # 知识库路由（已更新）
│   ├── queues/
│   │   └── document-queue.ts          # BullMQ 文档处理队列
│   └── index.ts                       # 主入口（需更新）
├── tests/
│   ├── knowledge/
│   │   ├── chunking.test.ts           # 切分模块测试
│   │   ├── embedding.test.ts          # 向量化测试
│   │   └── file-upload.test.ts        # 文件上传测试
│   └── setup.ts                       # Jest 配置
├── jest.config.js                     # Jest 配置文件
├── .env.example                       # 环境变量示例
└── PHASE2_README.md                   # 本文档
```

## 🚀 启动说明

### 1. 安装依赖

```bash
cd apps/backend

# 安装 Phase 2 新增依赖
npm install pdf-parse mammoth bullmq ioredis axios swagger-ui-express swagger-jsdoc multer --save

# 安装开发依赖
npm install --save-dev @types/multer
```

> **注意**: 如果遇到 npm 权限问题，请先运行：
> ```bash
> sudo chown -R $(whoami) /Users/canghe/.npm
> ```

### 2. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，填入实际配置
# 特别是：
# - DATABASE_URL (PostgreSQL 连接字符串)
# - ALIYUN_EMBEDDING_API_KEY (阿里云 API Key)
# - MINIO_* (MinIO 配置)
```

### 3. 启动依赖服务

#### PostgreSQL (需要 pgvector 扩展)

```bash
# 使用 Docker 启动
docker run -d \
  --name postgres-kb \
  -e POSTGRES_USER=knowledge_base \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=knowledge_base_db \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  pgvector/pgvector:pg15

# 或者使用本地 PostgreSQL，确保安装 pgvector 扩展
```

#### Redis

```bash
# 使用 Docker 启动
docker run -d \
  --name redis-kb \
  -p 6379:6379 \
  redis:7-alpine

# 或使用本地 Redis
brew install redis
brew services start redis
```

#### MinIO

```bash
# 使用 Docker 启动
docker run -d \
  --name minio-kb \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v minio-data:/data \
  minio/minio server /data --console-address ":9001"

# 访问 MinIO 控制台：http://localhost:9001
```

### 4. 数据库迁移

```bash
# 生成 Prisma 客户端
npm run db:generate

# 运行迁移
npm run db:migrate
```

### 5. 启动后端服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

### 6. 访问 API 文档

启动服务后，访问：
- Swagger UI: `http://localhost:3001/api-docs`
- 健康检查：`http://localhost:3001/health`

## 🧪 测试说明

### 运行单元测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- chunking.test.ts
npm test -- embedding.test.ts
npm test -- file-upload.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 监视模式（开发时使用）
npm test -- --watch
```

### 手动测试 API

#### 1. 创建知识库

```bash
curl -X POST http://localhost:3001/api/knowledge-bases \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your-tenant-id" \
  -d '{
    "name": "测试知识库",
    "description": "Phase 2 测试"
  }'
```

#### 2. 上传文档

```bash
curl -X POST http://localhost:3001/api/knowledge-bases/{kbId}/documents \
  -H "x-tenant-id: your-tenant-id" \
  -F "file=@/path/to/document.pdf"
```

#### 3. 查询文档列表

```bash
curl http://localhost:3001/api/knowledge-bases/{kbId}/documents \
  -H "x-tenant-id: your-tenant-id"
```

#### 4. 知识检索

```bash
curl -X POST http://localhost:3001/api/knowledge-bases/{kbId}/search \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your-tenant-id" \
  -d '{
    "query": "如何重置密码？",
    "topK": 5,
    "useHybrid": true
  }'
```

#### 5. 创建问答对

```bash
curl -X POST http://localhost:3001/api/knowledge-bases/{kbId}/qa-pairs \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your-tenant-id" \
  -d '{
    "question": "如何联系客服？",
    "answer": "您可以通过以下方式联系客服：...",
    "category": "联系方式",
    "tags": ["客服", "联系方式"]
  }'
```

## 📋 API 端点列表

### 知识库管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/knowledge-bases` | 创建知识库 |
| GET | `/api/knowledge-bases` | 获取知识库列表 |
| GET | `/api/knowledge-bases/:id` | 获取知识库详情 |
| PUT | `/api/knowledge-bases/:id` | 更新知识库 |
| DELETE | `/api/knowledge-bases/:id` | 删除知识库 |

### 文档管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/knowledge-bases/:id/documents` | 上传单个文档 |
| POST | `/api/knowledge-bases/:id/documents/batch` | 批量上传文档 |
| GET | `/api/knowledge-bases/:kbId/documents` | 获取文档列表 |
| GET | `/api/knowledge-bases/:kbId/documents/:docId` | 获取文档详情 |
| DELETE | `/api/knowledge-bases/:kbId/documents/:docId` | 删除文档 |

### 知识片段
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge-bases/:kbId/chunks` | 获取知识片段列表 |

### 问答对管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/knowledge-bases/:kbId/qa-pairs` | 创建问答对 |
| PUT | `/api/knowledge-bases/qa-pairs/:id` | 更新问答对 |
| DELETE | `/api/knowledge-bases/qa-pairs/:id` | 删除问答对 |
| GET | `/api/knowledge-bases/:kbId/qa-pairs` | 获取问答对列表 |

### 知识检索
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/knowledge-bases/:kbId/search` | 向量/混合检索 |

## ⚙️ 配置说明

### 文件上传限制
- 最大文件大小：50MB
- 支持格式：PDF, DOCX, DOC, TXT, MD
- 批量上传：最多 10 个文件

### 知识切分配置
- 默认片段大小：800 字符
- 重叠窗口：200 字符
- 最小片段：300 字符

### 向量化配置
- 批量大小：10 条/批
- 最大重试：3 次
- 向量维度：1536

### 队列配置
- 并发处理：2 个任务
- 失败重试：3 次
- 退避策略：指数退避

## 🔍 故障排查

### 常见问题

#### 1. MinIO 连接失败
```bash
# 检查 MinIO 是否运行
docker ps | grep minio

# 检查网络
curl http://localhost:9000/minio/health/live
```

#### 2. Redis 连接失败
```bash
# 检查 Redis 是否运行
docker ps | grep redis

# 测试连接
redis-cli ping
```

#### 3. 文档解析失败
- 检查文件格式是否支持
- 检查文件是否损坏
- 查看日志：`logs/app.log`

#### 4. 向量生成失败
- 检查阿里云 API Key 是否有效
- 检查网络连接
- 查看 API 配额

## 📊 监控和日志

### 日志位置
- 文件日志：`logs/app.log`
- 控制台日志：终端输出

### 队列监控
```typescript
import { getQueueStatus } from './src/queues/document-queue';

const status = await getQueueStatus();
console.log(status);
// { waiting: 0, active: 1, completed: 10, failed: 0 }
```

## 🎯 Phase 2 完成检查清单

- [x] MinIO 文件上传服务
- [x] 文档解析器（PDF/Word/TXT/MD）
- [x] 知识切分模块
- [x] 向量化服务（阿里云 Embedding）
- [x] 向量存储（pgvector）
- [x] 知识检索接口
- [x] 知识库管理后台 API
- [x] 异步任务队列（BullMQ）
- [x] API 文档（Swagger）
- [x] 单元测试

---

**Phase 2 开发完成！🎉**

下一步：前端集成和 UI 开发
