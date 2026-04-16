# 部署指南 - 智能客服平台

本指南详细说明如何将智能客服平台部署到生产环境。

## 📋 目录

- [环境要求](#环境要求)
- [部署方式](#部署方式)
- [Docker 部署（推荐）](#docker-部署推荐)
- [Kubernetes 部署](#kubernetes-部署)
- [手动部署](#手动部署)
- [配置说明](#配置说明)
- [监控与日志](#监控与日志)
- [故障排查](#故障排查)

---

## 环境要求

### 硬件要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 4 核 | 8 核+ |
| 内存 | 8GB | 16GB+ |
| 磁盘 | 50GB SSD | 100GB+ SSD |
| 网络 | 100Mbps | 1Gbps |

### 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (手动部署时)
- PostgreSQL 15+
- Redis 7+

---

## 部署方式

### 方式对比

| 方式 | 适用场景 | 难度 | 可扩展性 |
|------|---------|------|---------|
| Docker Compose | 中小规模 | ⭐⭐ | ⭐⭐⭐ |
| Kubernetes | 大规模、高可用 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 手动部署 | 开发/测试 | ⭐⭐⭐ | ⭐⭐ |

---

## Docker 部署（推荐）

### 1. 准备工作

```bash
# 克隆项目
git clone https://github.com/your-org/icsa.git
cd icsa

# 复制环境变量文件
cp docker/.env.example docker/.env
```

### 2. 配置环境变量

编辑 `docker/.env` 文件：

```bash
# 数据库配置
POSTGRES_USER=icsa
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
POSTGRES_DB=icsa

# Redis 配置
REDIS_PASSWORD=STRONG_PASSWORD_HERE

# MinIO 配置
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=STRONG_PASSWORD_HERE

# JWT 配置
JWT_SECRET=VERY_LONG_RANDOM_SECRET_KEY

# 阿里云 API 配置
ALIYUN_API_KEY=your_api_key

# 其他配置
FRONTEND_URL=https://your-domain.com
REACT_APP_API_URL=https://api.your-domain.com
```

### 3. 启动服务

```bash
# 进入 docker 目录
cd docker

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. 数据库迁移

```bash
# 执行数据库迁移
docker exec icsa-backend pnpm db:migrate

# 创建初始管理员账户
docker exec icsa-backend pnpm db:seed
```

### 5. 验证部署

```bash
# 检查健康状态
curl http://localhost:3001/health

# 访问前端
open http://localhost:3000
```

### 6. 配置 Nginx（可选）

如果使用 Nginx 反向代理：

```bash
# 配置 SSL 证书
cp /path/to/ssl.crt docker/ssl/
cp /path/to/ssl.key docker/ssl/

# 重启 Nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Kubernetes 部署

### 1. 准备 Kubernetes 集群

```bash
# 确保 kubectl 已配置
kubectl cluster-info

# 创建命名空间
kubectl create namespace icsa
```

### 2. 创建 Secrets

```bash
# 创建数据库密码
kubectl create secret generic icsa-db-secret \
  --from-literal=POSTGRES_USER=icsa \
  --from-literal=POSTGRES_PASSWORD=STRONG_PASSWORD \
  --namespace=icsa

# 创建 JWT 密钥
kubectl create secret generic icsa-jwt-secret \
  --from-literal=JWT_SECRET=VERY_LONG_RANDOM_SECRET \
  --namespace=icsa
```

### 3. 部署应用

```bash
# 应用 Kubernetes 配置
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/minio.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

### 4. 验证部署

```bash
# 查看 Pod 状态
kubectl get pods -n icsa

# 查看服务状态
kubectl get svc -n icsa

# 查看日志
kubectl logs -f deployment/icsa-backend -n icsa
```

---

## 手动部署

### 1. 安装依赖

```bash
# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -

# 安装 PostgreSQL 15
sudo apt-get install -y postgresql-15

# 安装 Redis 7
sudo apt-get install -y redis-server

# 安装 MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

### 2. 配置数据库

```bash
# 创建数据库
sudo -u postgres psql
CREATE DATABASE icsa;
CREATE USER icsa WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE icsa TO icsa;
\q
```

### 3. 配置环境变量

```bash
# 创建 .env 文件
cat > apps/backend/.env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://icsa:your_password@localhost:5432/icsa
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
JWT_SECRET=your_jwt_secret
ALIYUN_API_KEY=your_api_key
EOF
```

### 4. 构建和启动

```bash
# 安装依赖
pnpm install

# 生成 Prisma 客户端
pnpm db:generate

# 数据库迁移
pnpm db:migrate

# 构建
pnpm build

# 启动后端
cd apps/backend
NODE_ENV=production node dist/index.js &

# 启动前端（使用 Nginx 或其他 Web 服务器）
cd apps/frontend
pnpm build
# 将 dist/ 目录部署到 Web 服务器
```

### 5. 配置 systemd 服务

创建 `/etc/systemd/system/icsa-backend.service`：

```ini
[Unit]
Description=Intelligent Customer Service Agent - Backend
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/path/to/icsa/apps/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable icsa-backend
sudo systemctl start icsa-backend
sudo systemctl status icsa-backend
```

---

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| NODE_ENV | 环境 | production | 是 |
| PORT | 后端端口 | 3001 | 否 |
| DATABASE_URL | PostgreSQL 连接串 | - | 是 |
| REDIS_URL | Redis 连接串 | redis://localhost:6379 | 是 |
| MINIO_ENDPOINT | MinIO 地址 | localhost:9000 | 是 |
| MINIO_ACCESS_KEY | MinIO 访问密钥 | minioadmin | 是 |
| MINIO_SECRET_KEY | MinIO 密钥 | minioadmin123 | 是 |
| JWT_SECRET | JWT 密钥 | - | 是 |
| JWT_EXPIRES_IN | JWT 过期时间 | 7d | 否 |
| ALIYUN_API_KEY | 阿里云 API 密钥 | - | 是 |
| FRONTEND_URL | 前端 URL | http://localhost:3000 | 否 |
| LOG_LEVEL | 日志级别 | info | 否 |

---

## 监控与日志

### 日志查看

```bash
# Docker Compose 日志
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# systemd 日志
journalctl -u icsa-backend -f
```

### 健康检查

```bash
# 后端健康检查
curl http://localhost:3001/health

# 数据库连接检查
docker exec icsa-postgres pg_isready

# Redis 连接检查
docker exec icsa-redis redis-cli ping
```

### 性能监控

建议使用以下工具：

- **Prometheus + Grafana**: 指标监控
- **ELK Stack**: 日志分析
- **Jaeger**: 分布式追踪

---

## 故障排查

### 常见问题

#### 1. 后端启动失败

```bash
# 查看详细日志
docker logs icsa-backend

# 检查数据库连接
docker exec icsa-backend ping -c 3 postgres

# 检查环境变量
docker exec icsa-backend env | grep DATABASE
```

#### 2. 数据库迁移失败

```bash
# 手动执行迁移
docker exec icsa-backend pnpm db:migrate

# 重置数据库（谨慎使用）
docker exec icsa-backend pnpm db:reset
```

#### 3. WebSocket 连接失败

检查 Nginx 配置：

```nginx
location /socket.io/ {
  proxy_pass http://backend:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

#### 4. 内存不足

调整 Docker 资源限制：

```yaml
deploy:
  resources:
    limits:
      memory: 2G
```

---

## 备份与恢复

### 数据库备份

```bash
# 备份
docker exec icsa-postgres pg_dump -U icsa icsa > backup.sql

# 恢复
docker exec -i icsa-postgres psql -U icsa icsa < backup.sql
```

### MinIO 备份

```bash
# 使用 mc 工具备储
mc cp -r icsa-data/ /backup/minio/
```

---

## 升级指南

### Docker Compose 升级

```bash
# 拉取最新镜像
docker-compose -f docker-compose.prod.yml pull

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 启动新服务
docker-compose -f docker-compose.prod.yml up -d

# 执行数据库迁移
docker exec icsa-backend pnpm db:migrate
```

---

## 安全建议

1. **修改所有默认密码**
2. **使用 HTTPS**
3. **配置防火墙**
4. **定期更新依赖**
5. **启用日志审计**
6. **配置备份策略**
7. **限制 API 访问频率**
8. **使用强 JWT 密钥**

---

## 联系支持

- **文档**: /docs/
- **GitHub Issues**: https://github.com/your-org/icsa/issues
- **邮箱**: support@yourcompany.com

---

**文档版本**: v1.0  
**最后更新**: 2026-04-16
