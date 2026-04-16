-- 初始化数据库扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建向量距离操作符
CREATE INDEX IF NOT EXISTS vector_index ON embeddings USING ivfflat (embedding vector_cosine_ops);
