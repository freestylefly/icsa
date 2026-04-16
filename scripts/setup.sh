#!/bin/bash

# 智能客服Agent - 项目初始化脚本
# Intelligent Customer Service Agent - Setup Script

set -e

echo "🚀 开始初始化智能客服Agent 项目..."

# 检查 Node.js 版本
echo "📦 检查 Node.js 版本..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ 错误：需要 Node.js 20 或更高版本"
  echo "   当前版本：$(node -v)"
  exit 1
fi
echo "✅ Node.js 版本：$(node -v)"

# 检查 pnpm
echo "📦 检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm 未安装，正在安装..."
  npm install -g pnpm
fi
echo "✅ pnpm 版本：$(pnpm -v)"

# 安装根依赖
echo "📦 安装根依赖..."
pnpm install

# 安装后端依赖
echo "📦 安装后端依赖..."
cd apps/backend
pnpm install
cd ../..

# 安装前端依赖
echo "📦 安装前端依赖..."
cd apps/frontend
pnpm install
cd ../..

# 安装 widget 依赖
echo "📦 安装 widget 依赖..."
cd apps/widget
pnpm install
cd ../..

# 配置后端环境变量
echo "🔧 配置后端环境变量..."
if [ ! -f "apps/backend/.env" ]; then
  cp apps/backend/.env.example apps/backend/.env
  echo "✅ 已创建 apps/backend/.env"
  echo "⚠️  请编辑 apps/backend/.env 配置数据库和 API 密钥"
else
  echo "✅ apps/backend/.env 已存在"
fi

# 生成 Prisma 客户端
echo "🔨 生成 Prisma 客户端..."
cd apps/backend
pnpm db:generate
cd ../..

# 检查 Docker
echo "🐳 检查 Docker..."
if ! command -v docker &> /dev/null; then
  echo "⚠️  Docker 未安装，请手动安装 Docker Desktop"
  echo "   https://www.docker.com/products/docker-desktop"
else
  echo "✅ Docker 版本：$(docker --version)"
fi

# 检查 Docker Compose
echo "🐳 检查 Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  echo "⚠️  Docker Compose 未安装"
else
  echo "✅ Docker Compose 版本：$(docker-compose --version)"
fi

# 创建日志目录
echo "📁 创建日志目录..."
mkdir -p apps/backend/logs

echo ""
echo "✅ 项目初始化完成！"
echo ""
echo "📖 下一步："
echo "   1. 编辑 apps/backend/.env 配置环境变量"
echo "   2. 启动 Docker 服务：pnpm docker:up"
echo "   3. 运行数据库迁移：cd apps/backend && pnpm db:migrate"
echo "   4. 启动开发服务：pnpm dev"
echo ""
echo "📚 查看文档：README.md 或 PHASE1-启动说明.md"
echo ""
