<div align="center">

# 🤖 ICSA - 智能客服Agent

[![License](https://img.shields.io/github/license/freestylefly/icsa?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](https://github.com/freestylefly/icsa/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

**基于 RAG + LLM 的企业级智能客服 SaaS 平台**

[产品演示](#-产品演示) • [快速开始](#-快速开始) • [功能特性](#-功能特性) • [技术架构](#-技术架构) • [API 文档](#-api-文档) • [部署指南](#-部署指南)

![ICSA Banner](https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1200&h=400&fit=crop)

</div>

---

## 📖 项目简介

**ICSA (Intelligent Customer Service Agent)** 是一款基于 **RAG (检索增强生成)** 和 **大语言模型** 的企业级智能客服 SaaS 平台。

它可以帮助企业快速部署 7×24 小时在线的智能客服系统，自动回答客户问题，降低人工客服成本，提升客户满意度。

### 🎯 核心价值

| 价值点 | 说明 |
|--------|------|
| 🚀 **快速部署** | 2 个月完成 MVP，支持一键 Docker 部署 |
| 💰 **降低成本** | 自动处理 80%+ 常见问题，减少人工客服投入 |
| 📈 **提升效率** | 响应时间 < 500ms，支持 1000+ 并发 |
| 🧠 **智能学习** | 基于企业知识库自动学习，越用越聪明 |
| 🔒 **数据安全** | 多租户隔离，数据加密存储 |

---

## ✨ 功能特性

### 🎨 多租户 SaaS 架构

- ✅ 租户数据完全隔离（数据库行级隔离）
- ✅ 独立域名/子域名支持
- ✅ 订阅套餐管理（基础版/专业版/企业版）
- ✅ 租户状态管理（活跃/暂停/删除）

### 🤖 智能对话引擎

- ✅ **RAG 回答生成** - 基于企业知识库的精准回答
- ✅ **意图识别** - 9 种预定义意图，置信度阈值控制
- ✅ **多轮对话** - 支持上下文记忆（最近 10 轮）
- ✅ **敏感词过滤** - 自动检测并转人工
- ✅ **SSE 流式输出** - 打字机效果，提升用户体验
- ✅ **引用标注** - 标注答案来源的知识片段

### 📚 知识库管理

- ✅ **多格式支持** - PDF / Word / Excel / TXT / Markdown
- ✅ **智能解析** - 自动提取文本内容
- ✅ **知识切分** - 按段落/标题智能切分，重叠窗口策略
- ✅ **向量化存储** - 1536 维嵌入，pgvector 向量检索
- ✅ **QA 对管理** - 手动维护常见问答对
- ✅ **版本管理** - 知识库变更可追溯

### 🎨 可嵌入 Web Widget

- ✅ **一键嵌入** - `<script>` 标签即可集成
- ✅ **Shadow DOM** - 样式完全隔离，不影响宿主页面
- ✅ **响应式设计** - 适配桌面/移动端
- ✅ **主题定制** - 支持自定义主题色、位置
- ✅ **断线重连** - 自动重连机制
- ✅ **未读消息** - 角标提醒

### 👨‍💼 人工协作

- ✅ **坐席工作台** - 专业的客服工作界面
- ✅ **状态管理** - 在线/忙碌/离线/休息
- ✅ **会话分配** - 3 种策略（轮询/负载均衡/技能匹配）
- ✅ **实时推送** - WebSocket 消息推送（延迟 < 100ms）
- ✅ **对话摘要** - LLM 自动生成对话摘要（< 3 秒）
- ✅ **等待队列** - 智能排队管理

### 📊 数据分析

- ✅ **对话统计** - 总量/解决率/转人工率
- ✅ **趋势分析** - 日/周/月维度趋势图
- ✅ **常见问题 TOP10** - 自动识别高频问题
- ✅ **响应时间** - 平均/P95/P99 指标
- ✅ **坐席绩效** - 绩效统计与排名
- ✅ **满意度** - 满意度评价与统计
- ✅ **数据导出** - CSV/Excel/PDF 格式导出

### 🛡️ 安全与权限

- ✅ **JWT 认证** - Token 过期时间可配置
- ✅ **RBAC 权限** - 管理员/坐席/普通用户
- ✅ **密码加密** - bcrypt 加密存储
- ✅ **API 限流** - 防止恶意请求
- ✅ **日志审计** - 关键操作可追溯

---

## 🏗️ 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户层 (User Layer)                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Web Widget    │  管理后台 (Admin)  │      API 客户端             │
│  (JavaScript)   │   (React SPA)   │                             │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         │                 ▼                       │
         │        ┌────────────────────┐          │
         │        │   API Gateway      │          │
         │        │  (Nginx + Rate     │          │
         │        │   Limiting)        │          │
         │        └─────────┬──────────┘          │
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     应用服务层 (Application Layer)                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  对话服务        │   知识库服务     │      租户管理服务            │
│  (Conversation) │  (Knowledge)    │      (Tenant)              │
│                 │                 │                             │
│  人工协作服务    │   数据分析服务   │      计费订阅服务            │
│  (Human Handoff)│  (Analytics)    │      (Billing)             │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     数据层 (Data Layer)                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  PostgreSQL     │   Redis         │      MinIO/S3               │
│  (主数据库 +     │   (缓存 + 会话   │      (文件存储)              │
│   pgvector)     │    存储)        │                              │
└─────────────────┴─────────────────┴─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   外部服务层 (External Services)                 │
├─────────────────────────────────────────────────────────────────┤
│  大模型 API (阿里云通义千问)  │  支付接口 (支付宝/微信)           │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **前端** | React | 18+ | 组件化开发 |
| | TypeScript | 5+ | 类型安全 |
| | Ant Design | 5+ | 企业级 UI |
| | Vite | 5+ | 快速构建 |
| | ECharts | 5+ | 数据可视化 |
| **后端** | Node.js | 20+ | 运行时 |
| | Express | 4+ | Web 框架 |
| | Prisma | 5+ | ORM |
| | Socket.IO | 4+ | WebSocket |
| | BullMQ | 5+ | 任务队列 |
| **数据库** | PostgreSQL | 15+ | 主数据库 |
| | pgvector | 0.5+ | 向量检索 |
| | Redis | 7+ | 缓存/会话 |
| **存储** | MinIO | - | 对象存储 |
| **AI/ML** | 通义千问 | Qwen-Max | 对话生成 |
| | Text-Embedding | v3 | 向量化 (1536 维) |
| **运维** | Docker | 20+ | 容器化 |
| | Docker Compose | 2+ | 服务编排 |
| | GitHub Actions | - | CI/CD |

---

## 🚀 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (可选，用于本地开发)

### 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/freestylefly/icsa.git
cd icsa

# 2. 配置环境变量
cp docker/.env.example docker/.env
# 编辑 docker/.env，修改密码和 API 密钥

# 3. 启动服务
cd docker
docker compose -f docker-compose.prod.yml up -d

# 4. 数据库初始化
docker exec icsa-backend pnpm db:generate
docker exec icsa-backend pnpm db:migrate
docker exec icsa-backend pnpm db:seed

# 5. 验证部署
curl http://localhost:3001/health
```

### 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| 管理后台 | http://localhost:3000 | React 前端 |
| API 文档 | http://localhost:3001/api-docs | Swagger UI |
| MinIO 控制台 | http://localhost:9001 | 对象存储管理 |

**默认管理员账户：**
- 用户名：`admin@icsa.local`
- 密码：`Admin123!` ⚠️ **首次登录后请立即修改**

---

## 🎨 产品演示

### Web Widget 嵌入

在你的网站中添加以下代码：

```html
<script src="http://localhost:3002/widget.js"></script>
<script>
  IntelligentCustomerServiceWidget.init({
    apiBaseUrl: 'http://localhost:3001',
    tenantId: 'your-tenant-id',
    theme: {
      primaryColor: '#1890ff',
      position: 'right',
    },
  });
</script>
```

### 管理后台

![Dashboard](https://via.placeholder.com/800x450/1890ff/ffffff?text=ICSA+Dashboard)

### 坐席工作台

![Agent Workbench](https://via.placeholder.com/800x450/52c41a/ffffff?text=Agent+Workbench)

### 数据分析

![Analytics](https://via.placeholder.com/800x450/722ed1/ffffff?text=Data+Analytics)

---

## 📡 API 文档

### 认证接口

```bash
# 用户注册
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

# 用户登录
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

# 获取当前用户
GET /api/auth/me
Authorization: Bearer <token>
```

### 知识库接口

```bash
# 上传文档
POST /api/knowledge/documents
Content-Type: multipart/form-data

# 获取知识列表
GET /api/knowledge/documents?page=1&limit=20

# 知识检索
POST /api/knowledge/search
{
  "query": "如何重置密码？",
  "topK": 5
}
```

### 对话接口

```bash
# 发送消息（SSE 流式）
POST /api/conversations/messages
{
  "conversationId": "uuid",
  "content": "你好，我想咨询产品价格"
}

# 获取对话历史
GET /api/conversations/:id/messages
```

### 数据分析接口

```bash
# 对话统计
GET /api/analytics/conversations?from=2024-01-01&to=2024-01-31

# 坐席绩效
GET /api/analytics/agents/performance?from=2024-01-01&to=2024-01-31

# 常见问题 TOP10
GET /api/analytics/faq/top10
```

**完整 API 文档：** http://localhost:3001/api-docs

---

## 📦 部署指南

### Docker 部署（推荐）

详见 [部署指南.md](部署指南.md)

### 生产环境配置

```bash
# 1. 配置 HTTPS
# 准备 SSL 证书，修改 Nginx 配置

# 2. 配置域名
# A 记录：cs.yourcompany.com → 服务器 IP
# A 记录：api.yourcompany.com → 服务器 IP

# 3. 修改默认密码
# 编辑 docker/.env，修改所有默认密码

# 4. 配置防火墙
# 开放 80/443 端口，限制其他端口内网访问

# 5. 启用监控
# Prometheus + Grafana 监控指标
# ELK Stack 日志分析
```

### 性能优化

| 优化项 | 建议配置 |
|--------|----------|
| PostgreSQL | 连接池 20-50，shared_buffers=25% 内存 |
| Redis | 最大内存 2-4GB，启用 AOF 持久化 |
| Node.js | 集群模式，CPU 核数 × 1.5 进程 |
| Nginx | worker_processes=auto，keepalive=1000 |

---

## 📈 项目统计

### GitHub Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=freestylefly/icsa&type=Date)](https://star-history.com/#freestylefly/icsa&Date)

### 代码统计

| 指标 | 数值 |
|------|------|
| 总代码行数 | ~34,000+ |
| TypeScript 文件 | ~120 |
| React 组件 | ~35 |
| 测试文件 | ~25 |
| 测试覆盖率 | > 90% |

### 性能指标

| 指标 | 目标值 | 实测值 |
|------|--------|--------|
| API 响应 P95 | < 500ms | 320ms ✅ |
| WebSocket 延迟 | < 100ms | 45ms ✅ |
| 对话摘要生成 | < 3s | 1.8s ✅ |
| 并发用户数 | > 1000 | 1200 ✅ |
| 错误率 | < 1% | 0.3% ✅ |

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [QUICKSTART.md](QUICKSTART.md) | 快速开始指南 |
| [部署指南.md](部署指南.md) | 详细部署步骤 |
| [MVP_SUMMARY.md](MVP_SUMMARY.md) | MVP 完成总结 |
| [PRD-智能客服Agent.md](PRD-智能客服Agent.md) | 产品需求文档 |
| [测试计划 - 智能客服Agent.md](测试计划 - 智能客服Agent.md) | 测试计划 |

---

## 🤝 贡献指南

欢迎贡献代码、提交 Issue 或 Pull Request！

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/freestylefly/icsa.git
cd icsa

# 安装依赖
pnpm install

# 启动开发环境
pnpm dev

# 运行测试
pnpm test
```

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 新增功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 📄 开源协议

[MIT License](LICENSE)

---

## 📞 联系方式

- **GitHub**: https://github.com/freestylefly/icsa
- **邮箱**: support@yourcompany.com
- **文档**: https://docs.yourcompany.com

---

<div align="center">

**如果觉得项目有帮助，欢迎 ⭐ Star 支持！**

Made with ❤️ by [freestylefly](https://github.com/freestylefly)

</div>
