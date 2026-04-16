# Phase 3 部署指南

## 📦 构建和部署

### 1. 后端服务部署

#### 依赖安装

```bash
cd apps/backend
npm install
```

#### 环境变量配置

创建 `.env` 文件：

```bash
# 服务器配置
PORT=3001
NODE_ENV=production

# Redis 配置
REDIS_URL=redis://localhost:6379

# LLM 配置（阿里云通义千问）
QWEN_API_KEY=your_qwen_api_key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
QWEN_MODEL=qwen-max
QWEN_MAX_TOKENS=2048
QWEN_TEMPERATURE=0.7
QWEN_TIMEOUT=30000

# 前端 URL（CORS）
FRONTEND_URL=https://your-domain.com

# 数据库配置（PostgreSQL）
DATABASE_URL=postgresql://user:password@localhost:5432/intelligent_customer_service

# MinIO 配置（对象存储）
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=document-storage
```

#### 数据库迁移

```bash
# 生成 Prisma 客户端
npm run db:generate

# 运行迁移
npm run db:migrate:prod

# （可选）种子数据
npm run db:seed
```

#### 构建和启动

```bash
# 构建
npm run build

# 启动
npm start

# 或使用 PM2（生产环境推荐）
pm2 start dist/index.js --name customer-service-backend
pm2 save
pm2 startup
```

### 2. Widget 部署

#### 依赖安装

```bash
cd apps/widget
npm install
```

#### 构建

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
```

构建产物：
- `dist/index.js` - UMD 格式（浏览器直接引入）
- `dist/index.es.js` - ES 模块格式
- `dist/index.css` - 样式文件

#### 部署到 CDN

```bash
# 方法 1: 手动上传
# 将 dist/index.js 上传到 CDN 或静态文件服务器

# 方法 2: 使用 npm publish
npm publish

# 方法 3: 使用公司内部 CDN
# 根据具体 CDN 配置
```

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name widget.your-domain.com;

    location /widget.js {
        alias /path/to/widget/dist/index.js;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=31536000";
    }

    location /widget.css {
        alias /path/to/widget/dist/index.css;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

### 3. 前端嵌入

#### 基本嵌入

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://widget.your-domain.com/widget.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      IntelligentCustomerServiceWidget.init({
        apiBaseUrl: 'https://api.your-domain.com',
        tenantId: 'your-tenant-id',
        theme: {
          primaryColor: '#1890ff',
          position: 'right',
        },
      });
    });
  </script>
</head>
<body>
  <!-- 网站内容 -->
</body>
</html>
```

### 4. Docker 部署

#### Dockerfile（后端）

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY prisma ./prisma

RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:password@postgres:5432/db
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: db
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  redis-data:
  postgres-data:
```

### 5. 监控和日志

#### 健康检查

```bash
curl https://api.your-domain.com/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-04-16T10:00:00.000Z"
}
```

#### 日志配置

Winston 日志默认输出到：
- 控制台（开发环境）
- 文件（生产环境）

配置日志级别：
```bash
LOG_LEVEL=info  # debug, info, warn, error
```

### 6. 性能优化

#### Redis 优化

```bash
# 配置 Redis 内存限制
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 数据库连接池

Prisma 默认连接池配置：
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // 连接池大小：默认 10
}
```

#### CDN 缓存策略

```
Cache-Control: public, max-age=31536000  // Widget 静态资源
Cache-Control: no-cache                  // API 响应
```

### 7. 安全加固

#### HTTPS 配置

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

#### CORS 配置

```typescript
// apps/backend/src/index.ts
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
```

#### 限流配置

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 个请求
  message: '请求过于频繁，请稍后再试',
});
```

### 8. 故障排查

#### 常见问题

**Widget 不显示**
1. 检查 CDN 链接是否正确
2. 检查浏览器控制台错误
3. 确认 CORS 配置

**WebSocket 连接失败**
1. 检查服务器是否启动
2. 确认防火墙允许 WebSocket 连接
3. 检查 Nginx WebSocket 代理配置

**Redis 连接失败**
```bash
# 检查 Redis 状态
redis-cli ping

# 查看 Redis 日志
docker logs redis-container
```

**LLM API 调用失败**
1. 检查 API Key 是否正确
2. 确认网络连接
3. 查看 LLM 服务状态

### 9. 扩展和扩容

#### 水平扩展

```bash
# 使用 PM2 Cluster 模式
pm2 start dist/index.js -i max

# 或使用 Docker Swarm / Kubernetes
```

#### 数据库读写分离

```typescript
// Prisma 支持多数据源配置
datasource db_primary {
  provider = "postgresql"
  url      = env("DATABASE_URL_PRIMARY")
}

datasource db_replica {
  provider = "postgresql"
  url      = env("DATABASE_URL_REPLICA")
}
```

### 10. 备份策略

#### Redis 备份

```bash
# 手动备份
redis-cli BGSAVE

# 自动备份（crontab）
0 2 * * * redis-cli BGSAVE
```

#### 数据库备份

```bash
# PostgreSQL 备份
pg_dump -U user db > backup.sql

# 恢复
psql -U user db < backup.sql
```

---

**部署检查清单**：

- [ ] 环境变量配置完成
- [ ] 数据库迁移完成
- [ ] Redis 连接正常
- [ ] LLM API Key 配置
- [ ] Widget 构建成功
- [ ] CDN 部署完成
- [ ] HTTPS 证书配置
- [ ] 监控告警配置
- [ ] 备份策略配置
- [ ] 性能测试通过

**部署完成后验证**：

1. 访问健康检查端点
2. 测试 Widget 嵌入
3. 测试对话功能
4. 测试文件上传
5. 测试转人工流程
6. 检查日志输出

---

**联系支持**: dev-team@yourcompany.com
