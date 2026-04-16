# Phase 4 快速启动指南

**5 分钟快速体验 Phase 4 新功能！**

---

## 🚀 快速开始

### 1. 启动开发环境

```bash
# 进入项目目录
cd /Users/canghe/lobsterai/project

# 启动所有服务（Docker）
pnpm docker:up

# 或者分别启动
cd apps/backend && pnpm dev  # 后端
cd apps/frontend && pnpm dev  # 前端
```

### 2. 运行 Phase 4 测试

```bash
# 运行所有 Phase 4 测试
./run-phase4-tests.sh

# 或者单独运行
pnpm test:integration  # 集成测试
artillery run tests/performance/artillery-config.yml  # 性能测试
```

### 3. 访问新功能

#### 坐席工作台
```
http://localhost:3000/agent/workbench
```

**功能**:
- 会话列表和聊天窗口
- 坐席状态控制（在线/忙碌/离线/休息）
- 实时消息推送
- 对话摘要生成

#### 数据仪表盘
```
http://localhost:3000/dashboard
```

**功能**:
- 核心指标卡片
- 对话趋势图表
- 坐席绩效排名
- 常见问题 TOP10
- 满意度统计

---

## 📡 API 测试

### 坐席状态管理

```bash
# 设置坐席在线
curl -X PUT http://localhost:3001/api/agents/agent_123/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001" \
  -H "Content-Type: application/json" \
  -d '{"status":"online","metadata":{"nickname":"客服小王"}}'

# 获取坐席状态
curl http://localhost:3001/api/agents/agent_123/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取所有坐席
curl http://localhost:3001/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"
```

### 会话分配

```bash
# 分配会话（负载均衡）
curl -X POST http://localhost:3001/api/agents/sessions/distribute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"conv_456","strategy":"load_balance"}'

# 坐席接受会话
curl -X POST http://localhost:3001/api/agents/sessions/DISTRIBUTION_ID/accept \
  -H "Authorization: Bearer YOUR_TOKEN"

# 完成会话
curl -X POST http://localhost:3001/api/agents/sessions/conv_456/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 对话摘要

```bash
# 生成对话摘要
curl -X POST http://localhost:3001/api/agents/sessions/conv_456/summary \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"
```

### 数据分析

```bash
# 获取对话统计
curl "http://localhost:3001/api/analytics/conversations?startDate=2024-04-01&endDate=2024-04-30" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"

# 获取对话趋势
curl "http://localhost:3001/api/analytics/conversations/trend?granularity=day&days=30" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"

# 获取常见问题 TOP10
curl "http://localhost:3001/api/analytics/faq/top?limit=10&days=30" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"

# 获取坐席排名
curl "http://localhost:3001/api/analytics/agents/ranking?startDate=2024-04-01&endDate=2024-04-30" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"

# 获取满意度统计
curl "http://localhost:3001/api/analytics/satisfaction" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001"
```

### 提交满意度评价

```bash
curl -X POST http://localhost:3001/api/analytics/satisfaction/rating \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: tenant_001" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_456",
    "rating": 5,
    "comment": "服务很好，解决问题很快",
    "tags": ["响应快", "专业"]
  }'
```

---

## 🧪 测试场景

### 场景 1: 坐席工作台完整流程

1. 坐席 A 登录，设置为在线状态
2. 创建新对话，自动分配给坐席 A
3. 坐席 A 接受会话，进行聊天
4. 生成对话摘要
5. 完成会话
6. 查看坐席绩效统计

### 场景 2: 负载均衡测试

1. 3 个坐席同时在线
2. 创建 10 个新对话
3. 验证会话均匀分配
4. 切换坐席 B 为忙碌状态
5. 新对话只分配给坐席 A 和 C

### 场景 3: 数据分析验证

1. 查看仪表盘核心指标
2. 验证对话趋势图
3. 检查坐席排名
4. 查看满意度分布
5. 导出报表

---

## 📊 性能基准

### 预期性能指标

| 指标 | 目标值 | 测试命令 |
|------|--------|----------|
| API 响应时间 P95 | < 500ms | artillery run --output report.json |
| WebSocket 延迟 | < 100ms | 浏览器开发者工具 |
| 对话摘要生成 | < 3s | POST /api/agents/sessions/:id/summary |
| 并发用户数 | > 1000 | artillery run config.yml |

### 运行性能测试

```bash
# 安装 Artillery
npm install -g artillery

# 运行性能测试
cd tests/performance
artillery run artillery-config.yml

# 查看报告
cat performance-report.json | jq '.agencies'
```

---

## 🔧 故障排查

### 后端启动失败

```bash
# 查看详细日志
cd apps/backend
pnpm dev

# 检查数据库连接
docker exec icsa-postgres pg_isready

# 检查 Redis 连接
docker exec icsa-redis redis-cli ping
```

### WebSocket 连接失败

1. 检查后端日志
2. 验证 Socket.IO 配置
3. 检查防火墙设置
4. 测试健康检查端点

```bash
curl http://localhost:3001/health
```

### 前端页面空白

1. 打开浏览器开发者工具
2. 查看 Console 错误
3. 检查 API 请求是否成功
4. 验证环境变量配置

---

## 📚 相关文档

- [Phase 4 开发计划](PHASE4_PLAN.md) - 详细开发计划
- [Phase 4 验收清单](PHASE4_CHECKLIST.md) - 功能验收标准
- [Phase 4 总结](PHASE4_SUMMARY.md) - 完成总结
- [部署指南](docs/DEPLOYMENT.md) - 生产环境部署
- [API 文档](http://localhost:3001/api-docs) - Swagger API 文档

---

## 💡 使用技巧

### 1. 快速切换坐席状态

在工作台页面，右侧面板可以快速切换状态：
- 🟢 在线 - 接收新会话
- 🔴 忙碌 - 不接收新会话
- 🟠 休息 - 临时离开
- ⚫ 离线 - 下班

### 2. 使用快捷回复

在聊天窗口，点击"常用语"快速插入预设回复。

### 3. 生成对话摘要

结束会话前，点击"生成摘要"自动生成对话总结。

### 4. 查看实时数据

仪表盘数据每 30 秒自动刷新，也可以手动点击"查询"按钮。

### 5. 导出报表

在仪表盘点击"导出报表"，支持 CSV/Excel/PDF 格式。

---

## 🎯 下一步

Phase 4 完成后，MVP 功能全部就绪！

**可以开始**:
1. 生产环境部署
2. 用户验收测试
3. 性能优化
4. 安全审计

**后续开发**:
- Phase 5: 高级功能（多语言、语音输入）
- Phase 6: 企业级功能（SSO、API 开放平台）

---

**开发团队**: 智能客服项目组 💻  
**文档版本**: v1.0  
**最后更新**: 2026-04-30
