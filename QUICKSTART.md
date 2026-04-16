# Phase 3 快速开始指南

## 🚀 5 分钟快速启动

### 1. 安装依赖

```bash
# 后端
cd apps/backend
npm install

# Widget
cd apps/widget
npm install
```

### 2. 配置环境变量

```bash
# 创建 .env 文件（apps/backend/.env）
cat > .env << EOF
QWEN_API_KEY=your_qwen_api_key
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost:5432/intelligent_customer_service
PORT=3001
EOF
```

### 3. 启动服务

```bash
# 终端 1: 启动 Redis
redis-server

# 终端 2: 启动后端
cd apps/backend
npm run dev

# 终端 3: 构建 Widget
cd apps/widget
npm run build
```

### 4. 测试

```bash
# 运行测试
./scripts/run-phase3-tests.sh

# 或手动运行
cd apps/backend
npm test
```

### 5. 嵌入 Widget

创建测试页面 `test-widget.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Widget 测试</title>
  <script src="../apps/widget/dist/index.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      IntelligentCustomerServiceWidget.init({
        apiBaseUrl: 'http://localhost:3001',
        tenantId: 'test_tenant',
        theme: {
          primaryColor: '#1890ff',
          position: 'right',
        },
      });
    });
  </script>
</head>
<body>
  <h1>Widget 测试页面</h1>
  <p>右下角应该出现聊天按钮</p>
</body>
</html>
```

用浏览器打开 `test-widget.html` 即可看到 Widget。

## 🔧 开发工作流

### 后端开发

```bash
cd apps/backend

# 开发模式（热重载）
npm run dev

# 运行特定测试
npm test -- session-manager.test.ts

# 类型检查
npx tsc --noEmit

# 代码格式化
npm run format
```

### Widget 开发

```bash
cd apps/widget

# 开发模式（监听构建）
npm run dev

# 生产构建
npm run build

# 查看构建产物
ls -la dist/
```

### 调试技巧

#### 后端调试

1. 使用 `console.log` 或 Winston 日志
2. 访问 Swagger UI: `http://localhost:3001/api-docs`
3. 健康检查: `curl http://localhost:3001/health`

#### Widget 调试

1. 打开浏览器开发者工具
2. Shadow DOM 调试：在 Elements 面板展开 `#shadow-root`
3. 控制台查看日志

## 📚 关键文件

### 后端核心文件

```
apps/backend/src/
├── services/
│   ├── conversation/
│   │   ├── conversation.service.ts      # 对话服务（入口）
│   │   ├── session-manager.service.ts   # 会话管理
│   │   └── history-manager.service.ts   # 历史管理
│   ├── llm/
│   │   ├── llm.service.ts               # LLM 调用
│   │   ├── intent-recognition.service.ts # 意图识别
│   │   └── rag-generator.service.ts     # RAG 生成
│   └── websocket/
│       └── websocket.gateway.ts         # WebSocket 网关
└── controllers/
    └── conversation/
        └── conversation.controller.ts    # API 控制器
```

### Widget 核心文件

```
apps/widget/src/
├── index.ts                              # 入口
├── components/
│   ├── Widget.tsx                        # 主组件
│   ├── ChatWindow.tsx                    # 聊天窗口
│   ├── MessageList.tsx                   # 消息列表
│   ├── MessageInput.tsx                  # 输入框
│   └── widget.css                        # 样式
└── hooks/
    ├── useConversation.ts                # 对话 Hook
    ├── useWebSocket.ts                   # WebSocket Hook
    └── useLocalStorage.ts                # 存储 Hook
```

## 🎯 常见任务

### 添加新意图

编辑 `apps/backend/src/services/llm/intent-recognition.service.ts`:

```typescript
const INTENTS: IntentDefinition[] = [
  // ... 现有意图
  {
    name: 'new_intent',
    description: '新意图描述',
    examples: ['示例 1', '示例 2'],
  },
];
```

### 修改 Widget 主题色

初始化时配置：

```javascript
IntelligentCustomerServiceWidget.init({
  // ...
  theme: {
    primaryColor: '#764ba2', // 修改这里
  },
});
```

### 调整会话 TTL

编辑 `apps/backend/src/services/conversation/session-manager.service.ts`:

```typescript
private readonly TTL_MS = 60 * 60 * 1000; // 改为 1 小时
```

### 添加新的 API 端点

1. 创建 Controller: `apps/backend/src/controllers/xxx.controller.ts`
2. 添加 Route: `apps/backend/src/routes/xxx.routes.ts`
3. 注册路由: `apps/backend/src/index.ts`

## 🐛 故障排查

### 后端启动失败

```bash
# 检查 Redis
redis-cli ping

# 检查数据库
npx prisma migrate status

# 查看日志
tail -f logs/app.log
```

### Widget 不显示

1. 检查 `dist/index.js` 是否存在
2. 检查 `<script>` 标签路径
3. 查看浏览器控制台错误
4. 确认 API 地址正确

### WebSocket 连接失败

1. 检查后端是否启动
2. 确认端口 3001 未被占用
3. 检查防火墙设置

## 📖 学习资源

- [Phase 3 完整文档](./PHASE3_README.md)
- [部署指南](./DEPLOYMENT.md)
- [API 文档](http://localhost:3001/api-docs)
- [示例页面](./apps/widget/examples/embed-example.html)

## 💡 提示

1. **先运行测试** - 确保所有测试通过
2. **使用 Swagger** - 快速测试 API
3. **查看日志** - 问题排查第一步
4. **Shadow DOM** - Widget 样式完全隔离
5. **Redis CLI** - 查看会话和历史数据

```bash
# 查看 Redis 中的会话
redis-cli
> keys session:*
> get session:your-session-id
```

---

**需要帮助？** 查看 [PHASE3_README.md](./PHASE3_README.md) 或联系开发团队。
