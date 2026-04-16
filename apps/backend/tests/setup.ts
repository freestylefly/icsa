/**
 * Jest 测试配置文件
 */

// 设置测试超时时间
jest.setTimeout(30000);

// 模拟环境变量
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'test';
process.env.MINIO_SECRET_KEY = 'test';
process.env.MINIO_BUCKET_NAME = 'test-bucket';
process.env.ALIYUN_EMBEDDING_API_KEY = 'test-key';

// 全局 beforeAll
beforeAll(() => {
  // 可以在这里进行全局设置
});

// 全局 afterAll
afterAll(async () => {
  // 清理资源
});

// 全局 beforeEach
beforeEach(() => {
  // 可以在这里重置 mocks
  jest.clearAllMocks();
});

// 全局 afterEach
afterEach(() => {
  // 可以在这里清理
});
