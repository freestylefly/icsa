# Phase 1 启动说明 - 项目初始化 + 租户管理

**完成日期：** 2026-04-15  
**开发周期：** 第 1-2 周  
**状态：** ✅ 已完成

---

## ✅ 已完成任务

### 1. 项目结构初始化

- ✅ Monorepo 架构搭建（pnpm workspace）
- ✅ TypeScript + ESLint + Prettier 配置
- ✅ 目录结构创建：
  - `apps/frontend` - React 管理后台
  - `apps/backend` - Node.js 后端服务
  - `apps/widget` - Web 聊天组件
  - `packages/shared` - 共享代码

### 2. Docker 开发环境

- ✅ PostgreSQL 15 + pgvector（向量数据库）
- ✅ Redis 7（缓存）
- ✅ MinIO（对象存储）
- ✅ Docker Compose 配置
- ✅ 健康检查配置

### 3. 数据库 Schema (Prisma)

- ✅ 租户表（Tenant）
- ✅ 用户表（User）
- ✅ 角色表（Role）
- ✅ 用户角色关联表（UserRole）
- ✅ 知识库相关表（KnowledgeBase, Document, KnowledgeChunk, QAPair）
- ✅ 对话相关表（Conversation, Message）
- ✅ Agent 配置表（Agent）

### 4. 租户管理 API

- ✅ `POST /api/tenants` - 创建租户
- ✅ `GET /api/tenants` - 获取租户列表（分页）
- ✅ `GET /api/tenants/:id` - 获取租户详情
- ✅ `PUT /api/tenants/:id` - 更新租户
- ✅ `DELETE /api/tenants/:id` - 删除租户（软删除）
- ✅ `PATCH /api/tenants/:id/status` - 暂停/恢复租户

### 5. 用户认证系统

- ✅ `POST /api/auth/register` - 用户注册
- ✅ `POST /api/auth/login` - 用户登录（JWT）
- ✅ `GET /api/auth/me` - 获取当前用户信息
- ✅ `PUT /api/auth/password` - 修改密码
- ✅ `POST /api/auth/logout` - 退出登录

### 6. 用户管理系统

- ✅ `POST /api/users` - 创建用户
- ✅ `GET /api/users` - 获取用户列表（分页）
- ✅ `GET /api/users/:id` - 获取用户详情
- ✅ `PUT /api/users/:id` - 更新用户
- ✅ `DELETE /api/users/:id` - 删除用户（软删除）
- ✅ `POST /api/users/:id/roles` - 分配角色

### 7. RBAC 权限系统

- ✅ 角色管理数据模型
- ✅ 权限中间件（authorize）
- ✅ 租户隔离中间件（tenantIsolation）
- ✅ JWT 认证中间件（authenticate）

### 8. 前端基础框架

- ✅ React 18 + Vite + TypeScript
- ✅ Ant Design 5 UI 组件库
- ✅ React Router 路由
- ✅ 页面路由框架
- ✅ 代理配置（/api → 后端）

### 9. Web Widget 框架

- ✅ Rollup 打包配置
- ✅ Widget 初始化接口
- ✅ TypeScript 类型定义

---

## 🚀 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 在项目根目录启动所有服务
pnpm docker:up

# 2. 查看日志
docker-compose -f docker/docker-compose.yml logs -f

# 3. 停止服务
pnpm docker:down
```

启动后访问：
- **前端：** http://localhost:3000
- **后端：** http://localhost:3001
- **健康检查：** http://localhost:3001/health
- **MinIO 控制台：** http://localhost:9001 (账号：minioadmin / 密码：minioadmin123)

### 方式二：本地开发

#### 1. 启动数据库和中间件

```bash
docker-compose -f docker/docker-compose.yml up -d postgres redis minio
```

#### 2. 配置后端环境变量

```bash
cd apps/backend
cp .env.example .env
# 编辑 .env 文件
```

#### 3. 安装依赖并初始化数据库

```bash
cd apps/backend
pnpm install
pnpm db:generate
pnpm db:migrate
```

#### 4. 启动后端服务

```bash
cd apps/backend
pnpm dev
```

后端将在 http://localhost:3001 启动

#### 5. 启动前端服务（新终端）

```bash
cd apps/frontend
pnpm install
pnpm dev
```

前端将在 http://localhost:3000 启动

---

## 📝 API 测试示例

### 1. 创建租户

```bash
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试企业",
    "slug": "test-company",
    "plan": "BASIC"
  }'
```

### 2. 用户注册

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "租户 ID",
    "email": "test@example.com",
    "password": "123456",
    "name": "测试用户"
  }'
```

### 3. 用户登录

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456"
  }'
```

响应将包含 JWT 令牌：

```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 4. 认证请求示例

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📁 关键文件位置

### 后端核心文件

- **入口文件：** `apps/backend/src/index.ts`
- **数据库 Schema：** `apps/backend/prisma/schema.prisma`
- **认证服务：** `apps/backend/src/services/auth.service.ts`
- **租户服务：** `apps/backend/src/services/tenant.service.ts`
- **用户服务：** `apps/backend/src/services/user.service.ts`
- **认证中间件：** `apps/backend/src/middleware/auth.middleware.ts`
- **错误处理：** `apps/backend/src/middleware/errorHandler.ts`

### 前端核心文件

- **入口文件：** `apps/frontend/src/main.tsx`
- **App 组件：** `apps/frontend/src/App.tsx`
- **Vite 配置：** `apps/frontend/vite.config.ts`

### 配置文件

- **Docker Compose：** `docker/docker-compose.yml`
- **环境变量示例：** `apps/backend/.env.example`
- **根 package.json：** `package.json`
- **pnpm workspace：** `pnpm-workspace.yaml`

---

## 🧪 下一步工作（Phase 2）

Phase 2 将实现知识库模块：

1. **文件上传接口** - 对接 MinIO 对象存储
2. **文档解析器** - PDF/Word/TXT/MD解析
3. **知识切分逻辑** - 按段落/标题自动切分
4. **向量化接口** - 调用阿里云 Embedding API
5. **pgvector 检索接口** - 向量相似度搜索
6. **知识库管理后台页面** - React 前端页面

---

## 🔧 常见问题

### 1. Docker 启动失败

```bash
# 查看日志
docker-compose -f docker/docker-compose.yml logs

# 重启服务
docker-compose -f docker/docker-compose.yml restart
```

### 2. 数据库连接失败

检查 `.env` 文件中的 `DATABASE_URL` 是否正确：

```
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/icsa_db
```

### 3. Prisma 客户端未生成

```bash
cd apps/backend
pnpm db:generate
```

### 4. 端口被占用

修改 `apps/backend/.env` 中的 `PORT` 或 `docker-compose.yml` 中的端口映射。

---

## 📞 技术支持

如有问题，请查看：

- **项目文档：** `README.md`
- **PRD 文档：** `PRD-智能客服Agent.md`
- **测试计划：** `测试计划 - 智能客服Agent.md`

---

**开发团队智能体** 💻  
2026-04-15
