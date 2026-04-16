/**
 * 智能客服平台 - 后端服务入口
 * Intelligent Customer Service Agent - Backend Server
 * Phase 3: 对话引擎 + Web Widget
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import { swaggerSpec } from './config/swagger.config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { initMinIOBucket } from './config/minio.config';
import { createDocumentWorker, closeQueue } from './queues/document-queue';
import { websocketGateway } from './services/websocket/websocket.gateway';
import { validateLLMConfig } from './config/llm.config';
import { authRoutes } from './routes/auth.routes';
import { tenantRoutes } from './routes/tenant.routes';
import { userRoutes } from './routes/user.routes';
import { knowledgeBaseRoutes } from './routes/knowledgeBase.routes';
import { conversationRoutes } from './routes/conversation.routes';
import { agentRoutes } from './routes/agent.routes';
import { analyticsRoutes } from './routes/analytics.routes';

// 加载环境变量
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ==================== 中间件 ====================

// 安全头
app.use(helmet());

// CORS 配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 个请求
  message: '请求过于频繁，请稍后再试',
});
app.use('/api/', limiter);

// ==================== API 文档 ====================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '智能客服平台 API',
}));

// ==================== 路由 ====================

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/knowledge-bases', knowledgeBaseRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', agentRoutes);
app.use('/api', analyticsRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 全局错误处理
app.use(errorHandler);

// ==================== 启动服务 ====================

let documentWorker: any;
let httpServer: any;

const startServer = async () => {
  try {
    // 验证 LLM 配置
    if (!validateLLMConfig()) {
      logger.warn('⚠️  LLM 配置不完整，对话功能可能无法使用');
    }

    // 初始化 MinIO
    logger.info('正在初始化 MinIO...');
    await initMinIOBucket();
    logger.info('MinIO 初始化完成');

    // 启动文档处理队列 Worker
    logger.info('正在启动文档处理队列...');
    documentWorker = createDocumentWorker();
    logger.info('文档处理队列已启动');

    // 创建 HTTP 服务器
    httpServer = createServer(app);

    // 初始化 WebSocket
    logger.info('正在初始化 WebSocket...');
    websocketGateway.init(httpServer);
    logger.info('WebSocket 已初始化');

    // 启动 HTTP 服务器
    httpServer.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功`, {
        port: PORT,
        env: process.env.NODE_ENV,
      });
      logger.info(`📍 健康检查：http://localhost:${PORT}/health`);
      logger.info(`📚 API 文档：http://localhost:${PORT}/api-docs`);
      logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('服务器启动失败', { error });
    process.exit(1);
  }
};

// 优雅关闭
const gracefulShutdown = async (signal: string) => {
  logger.info(`收到信号 ${signal}，正在优雅关闭...`);

  // 关闭 HTTP 服务器
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP 服务器已关闭');
    });
  }

  // 关闭 WebSocket
  try {
    websocketGateway.getIO().close();
    logger.info('WebSocket 已关闭');
  } catch (error) {
    logger.error('关闭 WebSocket 失败', { error });
  }

  // 关闭队列连接
  try {
    await closeQueue();
    logger.info('队列连接已关闭');
  } catch (error) {
    logger.error('关闭队列失败', { error });
  }

  // 关闭数据库连接
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.info('数据库连接已关闭');
  } catch (error) {
    logger.error('关闭数据库失败', { error });
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动服务器
startServer();

export default app;
