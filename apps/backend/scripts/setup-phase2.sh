#!/bin/bash

# Phase 2 设置脚本
# 用于安装依赖、配置环境、启动服务

set -e

echo "🚀 Phase 2 知识库模块 - 设置脚本"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js"
    exit 1
fi

echo "✅ Node.js 版本：$(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误：未找到 npm"
    exit 1
fi

echo "✅ npm 版本：$(npm -v)"

# 检查 Docker（可选）
if command -v docker &> /dev/null; then
    echo "✅ Docker 可用"
else
    echo "⚠️  警告：Docker 未安装，需要手动配置 PostgreSQL、Redis、MinIO"
fi

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install

# 复制环境变量
if [ ! -f .env ]; then
    echo ""
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件，配置必要的环境变量"
else
    echo "✅ .env 文件已存在"
fi

# 生成 Prisma 客户端
echo ""
echo "🔧 生成 Prisma 客户端..."
npm run db:generate

# 提示用户
echo ""
echo "================================"
echo "✅ 设置完成！"
echo ""
echo "下一步："
echo "1. 编辑 .env 文件，配置环境变量"
echo "2. 启动依赖服务（PostgreSQL、Redis、MinIO）"
echo "3. 运行数据库迁移：npm run db:migrate"
echo "4. 启动服务：npm run dev"
echo ""
echo "📚 API 文档：http://localhost:3001/api-docs"
echo "================================"
