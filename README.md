# 智能客服Agent - Intelligent Customer Service Agent

🤖 开箱即用的智能客服 SaaS 平台，让中小企业以极低的成本获得企业级的 7×24 小时智能客服能力。

## 📋 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [部署说明](#部署说明)

## ✨ 功能特性

### MVP 功能（Phase 1-4）

- ✅ **多租户架构** - 企业数据完全隔离
- ✅ **用户认证系统** - JWT 认证 + RBAC 权限管理
- 🚧 **知识库管理** - 文档上传、解析、向量化（Phase 2）
- 🚧 **智能对话引擎** - RAG 回答生成、意图识别（Phase 3）
- 🚧 **Web Widget** - 可嵌入网站的聊天窗口（Phase 3）
- 🚧 **人工协作** - 人机转接、坐席管理（Phase 4）
- 🚧 **数据分析** - 对话量统计、解决率报表（Phase 4）

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript
- Ant Design 5 (UI 组件库)
- Vite (构建工具)
- Zustand (状态管理)

### 后端
- Node.js 20 + Express
- TypeScript
- Prisma (ORM)
- PostgreSQL 15 + pgvector (向量数据库)
- Redis 7 (缓存)
- MinIO (对象存储)

### 大模型
- 阿里云通义千问 API

### 基础设施
- Docker + Docker Compose
- pnpm (包管理)

## 🚀 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. 克隆项目

```bash
cd /Users/canghe/lobsterai/project
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cd apps/backend
cp .env.example .env
# 编辑 .env 文件，配置数据库和 API 密钥
```

### 4. 启动开发环境

#### 方式一：使用 Docker Compose（推荐）

```bash
# 在项目根目录执行
pnpm docker:up
```

启动后访问：
- 前端：http://localhost:3000
- 后端：http://localhost:3001
- MinIO 控制台：http://localhost:9001

#### 方式二：本地开发

```bash
# 1. 启动数据库和中间件（Docker）
docker-compose -f docker/docker-compose.yml up -d postgres redis minio

# 2. 安装后端依赖并生成 Prisma 客户端
cd apps/backend
pnpm install
pnpm db:generate
pnpm db:migrate

# 3. 启动后端服务
pnpm dev

# 4. 新终端启动前端
cd apps/frontend
pnpm install
pnpm dev
```

### 5. 数据库迁移

```bash
cd apps/backend
pnpm db:migrate
```

## 📁 项目结构

```
project/
├── apps/
│   ├── frontend/          # React 管理后台
│   ├── backend/           # Node.js 后端服务
│   └── widget/            # Web 聊天组件
├── packages/
│   └── shared/            # 共享代码
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── package.json           # 根 package.json (monorepo)
└── pnpm-workspace.yaml
```

## 📖 开发指南

### 后端开发

```bash
cd apps/backend

# 开发模式
pnpm dev

# 数据库操作
pnpm db:generate    # 生成 Prisma 客户端
pnpm db:migrate     # 开发环境迁移
pnpm db:studio      # 打开 Prisma Studio

# 测试
pnpm test

# 构建
pnpm build
```

### 前端开发

```bash
cd apps/frontend

# 开发模式
pnpm dev

# 构建
pnpm build
```

### Widget 开发

```bash
cd apps/widget

# 开发模式
pnpm dev

# 构建
pnpm build
```

## 📦 部署说明

### 生产环境部署

1. **配置环境变量**

```bash
# apps/backend/.env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=strong-random-secret
ALIYUN_API_KEY=your-key
```

2. **构建镜像**

```bash
docker-compose -f docker/docker-compose.yml build
```

3. **启动服务**

```bash
docker-compose -f docker/docker-compose.yml up -d
```

4. **数据库迁移**

```bash
docker exec icsa-backend pnpm db:migrate:prod
```

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| NODE_ENV | 环境 | development |
| PORT | 后端端口 | 3001 |
| DATABASE_URL | PostgreSQL 连接串 | - |
| REDIS_URL | Redis 连接串 | redis://localhost:6379 |
| MINIO_ENDPOINT | MinIO 地址 | localhost:9000 |
| MINIO_ACCESS_KEY | MinIO 访问密钥 | minioadmin |
| MINIO_SECRET_KEY | MinIO 密钥 | minioadmin123 |
| JWT_SECRET | JWT 密钥 | - |
| ALIYUN_API_KEY | 阿里云 API 密钥 | - |

## 📝 API 文档

### 认证接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户
- `PUT /api/auth/password` - 修改密码
- `POST /api/auth/logout` - 退出登录

### 租户管理

- `POST /api/tenants` - 创建租户
- `GET /api/tenants` - 获取租户列表
- `GET /api/tenants/:id` - 获取租户详情
- `PUT /api/tenants/:id` - 更新租户
- `DELETE /api/tenants/:id` - 删除租户
- `PATCH /api/tenants/:id/status` - 暂停/恢复租户

### 用户管理

- `POST /api/users` - 创建用户
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户
- `POST /api/users/:id/roles` - 分配角色

## 🧪 测试

```bash
# 运行测试
pnpm test

# 测试覆盖率
pnpm test -- --coverage
```

## 📄 License

MIT

## 👥 团队

开发团队智能体 💻

---

**文档版本：** v1.0  
**最后更新：** 2026-04-15
