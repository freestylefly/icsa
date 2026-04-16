# Phase 3: 对话引擎 + Web Widget 开发文档

## 📋 开发概览

Phase 3 在第 5-6 周完成，主要实现智能客服的核心对话能力和前端交互界面。

### ✅ 已完成功能

#### 1. 对话服务核心

- **会话管理** (`session-manager.service.ts`)
  - 会话创建/销毁
  - 会话状态管理（active/closed/transferred）
  - Redis 存储，TTL=30 分钟
  - 支持元数据

- **对话历史管理** (`history-manager.service.ts`)
  - 多轮对话历史存储
  - 最近 10 轮对话限制
  - Redis 列表存储，TTL=30 分钟
  - 支持上下文提取

- **对话服务** (`conversation.service.ts`)
  - 整合会话管理、历史管理、意图识别、RAG 生成
  - 支持同步和流式（SSE）两种模式
  - 敏感词检测
  - 自动转人工逻辑

#### 2. 意图识别模块

- **意图识别服务** (`intent-recognition.service.ts`)
  - Prompt 模板引擎
  - 支持 9 种预定义意图
  - 置信度阈值判断（<0.6 转人工）
  - 实体提取

- **LLM 服务** (`llm.service.ts`)
  - 阿里云通义千问 Qwen-Max 集成
  - 支持同步和流式调用
  - 专用意图识别配置
  - 专用 RAG 生成配置

#### 3. RAG 回答生成

- **RAG 生成器** (`rag-generator.service.ts`)
  - 知识检索集成
  - Prompt 组装（系统提示 + 对话历史 + 知识片段）
  - SSE 流式输出
  - 引用标注
  - 按意图分类的系统提示模板

#### 4. Web Widget 组件

- **主组件** (`Widget.tsx`)
  - Shadow DOM 样式隔离
  - React 18 集成
  - 可配置主题色和位置
  - 断线重连机制

- **子组件**
  - `ChatWindow.tsx` - 聊天窗口
  - `MessageList.tsx` - 消息列表
  - `MessageInput.tsx` - 消息输入框
  - `ConnectionStatus.tsx` - 连接状态指示器
  - `UnreadBadge.tsx` - 未读消息徽章

- **Hooks**
  - `useConversation` - 对话状态管理
  - `useWebSocket` - WebSocket 连接管理
  - `useLocalStorage` - 本地存储

- **样式**
  - 完整的 CSS 样式文件
  - 响应式设计
  - 动画效果（打字指示器、连接状态等）

#### 5. 实时通信

- **WebSocket 网关** (`websocket.gateway.ts`)
  - Socket.IO 集成
  - 用户/坐席认证
  - 房间管理
  - 心跳机制
  - 消息推送

- **转人工服务** (`handoff.service.ts`)
  - 工单管理
  - 优先级队列
  - 坐席分配

### 📁 文件结构

```
apps/
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── conversation/
│   │   │   │   ├── conversation.service.ts ✅
│   │   │   │   ├── session-manager.service.ts ✅
│   │   │   │   └── history-manager.service.ts ✅
│   │   │   ├── llm/
│   │   │   │   ├── llm.service.ts ✅
│   │   │   │   ├── intent-recognition.service.ts ✅
│   │   │   │   └── rag-generator.service.ts ✅
│   │   │   ├── websocket/
│   │   │   │   └── websocket.gateway.ts ✅
│   │   │   └── human-handoff/
│   │   │       ├── handoff.service.ts ✅
│   │   │       ├── queue-manager.service.ts ✅
│   │   │       └── sensitivity-filter.service.ts ✅
│   │   └── controllers/
│   │       └── conversation/
│   │           └── conversation.controller.ts ✅
│   └── tests/
│       └── conversation/
│           ├── session-manager.test.ts ✅
│           ├── history-manager.test.ts ✅
│           └── conversation-service.test.ts ✅
│       └── llm/
│           └── intent-recognition.test.ts ✅
└── widget/
    ├── src/
    │   ├── index.ts ✅
    │   ├── components/
    │   │   ├── Widget.tsx ✅
    │   │   ├── ChatWindow.tsx ✅
    │   │   ├── MessageList.tsx ✅
    │   │   ├── MessageInput.tsx ✅
    │   │   ├── ConnectionStatus.tsx ✅
    │   │   ├── UnreadBadge.tsx ✅
    │   │   └── widget.css ✅
    │   └── hooks/
    │       ├── useConversation.ts ✅
    │       ├── useWebSocket.ts ✅
    │       └── useLocalStorage.ts ✅
    ├── rollup.config.js ✅
    └── examples/
        └── embed-example.html ✅
```

### 🔧 配置说明

#### 环境变量

```bash
# LLM 配置（阿里云通义千问）
QWEN_API_KEY=your_api_key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
QWEN_MODEL=qwen-max
QWEN_MAX_TOKENS=2048
QWEN_TEMPERATURE=0.7
QWEN_TIMEOUT=30000

# Redis 配置
REDIS_URL=redis://localhost:6379

# WebSocket 配置
FRONTEND_URL=http://localhost:3000

# 服务器配置
PORT=3001
```

#### Widget 初始化

```javascript
IntelligentCustomerServiceWidget.init({
  apiBaseUrl: 'https://your-api.com',
  tenantId: 'your-tenant-id',
  agentId: 'your-agent-id', // 可选
  theme: {
    primaryColor: '#1890ff',
    position: 'right', // 'left' 或 'right'
  },
});
```

### 🧪 测试

#### 运行测试

```bash
# 后端测试
cd apps/backend
npm test

# 运行特定测试
npm test -- session-manager.test.ts
npm test -- history-manager.test.ts
npm test -- intent-recognition.test.ts
npm test -- conversation-service.test.ts

# Widget 构建
cd apps/widget
npm run build
```

#### 测试覆盖率

- ✅ 会话管理器测试（TTL、状态转换、CRUD）
- ✅ 历史管理器测试（消息限制、上下文提取）
- ✅ 意图识别测试（意图分类、置信度、实体提取）
- ✅ 对话服务集成测试（端到端流程）

### 📊 API 端点

#### 会话管理

```
POST   /api/conversations/sessions          # 创建会话
GET    /api/conversations/sessions/:id      # 获取会话
POST   /api/conversations/sessions/:id/close # 关闭会话
GET    /api/conversations/sessions/active   # 获取活跃会话
```

#### 对话消息

```
POST   /api/conversations/messages          # 发送消息（非流式）
GET    /api/conversations/messages/stream   # 发送消息（SSE 流式）
GET    /api/conversations/:id/history       # 获取历史
DELETE /api/conversations/:id/history       # 清空历史
```

#### 转人工

```
POST   /api/conversations/handoffs          # 创建转人工请求
GET    /api/conversations/handoffs/:id      # 获取工单
POST   /api/conversations/handoffs/:id/assign # 分配工单
POST   /api/conversations/handoffs/:id/accept # 接受工单
POST   /api/conversations/handoffs/:id/close  # 关闭工单
```

### 🎯 核心流程

#### 1. 对话处理流程

```
用户消息
  ↓
敏感词检测 → 敏感 → 转人工
  ↓ 正常
意图识别
  ↓
置信度 < 0.6 → 转人工
  ↓ ≥ 0.6
知识检索（RAG）
  ↓
LLM 生成回答
  ↓
添加引用标注
  ↓
保存历史
  ↓
返回响应
```

#### 2. WebSocket 消息流

```
客户端连接
  ↓
发送 authenticate
  ↓
加入房间（user:{sessionId}）
  ↓
发送 send_message
  ↓
服务器处理
  ↓
接收 receive_message
```

### 🔐 安全特性

1. **敏感词过滤** - 自动检测并转人工
2. **会话隔离** - 每个用户独立会话
3. **WebSocket 认证** - 连接需要认证
4. **CORS 配置** - 限制跨域访问
5. **限流保护** - API 请求频率限制

### 📈 性能优化

1. **Redis 缓存** - 会话和历史都存储在 Redis
2. **TTL 自动清理** - 30 分钟自动过期
3. **消息限制** - 最多保留 10 轮对话
4. **流式输出** - SSE 减少首字延迟
5. **懒加载** - Widget 按需加载

### 🐛 已知问题

1. **Embedding 服务** - RAG 中的 embedding 调用需要实际集成
2. **向量检索** - 需要使用真实的 query embedding
3. **坐席队列** - 坐席分配逻辑需要完善

### 🚀 下一步计划

#### Phase 4: 数据分析 + 运营后台

- 对话数据统计
- 用户满意度调查
- 知识库使用分析
- 坐席绩效管理
- 运营后台界面

### 📝 使用示例

#### 嵌入 Widget

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://your-domain.com/widget.js"></script>
</head>
<body>
  <script>
    IntelligentCustomerServiceWidget.init({
      apiBaseUrl: 'https://api.yourcompany.com',
      tenantId: 'tenant_123',
      theme: {
        primaryColor: '#764ba2',
        position: 'right',
      },
    });
  </script>
</body>
</html>
```

#### API 调用示例

```javascript
// 创建会话
const session = await fetch('/api/conversations/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'tenant_123',
    userId: 'user_456',
  }),
});

// 发送消息（流式）
const response = await fetch(
  '/api/conversations/messages/stream?' + 
  new URLSearchParams({
    tenantId: 'tenant_123',
    sessionId: 'session_789',
    message: '你好',
  })
);

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log(chunk); // SSE 数据
}
```

---

**开发完成时间**: 2024 年 4 月  
**开发团队**: 智能客服项目组  
**文档版本**: v1.0
