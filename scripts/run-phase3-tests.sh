#!/bin/bash

# Phase 3 测试运行脚本
# 用于运行所有 Phase 3 相关的单元测试

set -e

echo "======================================"
echo "🧪 Phase 3 测试套件"
echo "======================================"
echo ""

cd apps/backend

# 检查依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
  echo "⚠️  未找到 node_modules，正在安装依赖..."
  npm install
fi

# 检查 Redis 连接
echo "🔌 检查 Redis 连接..."
if ! command -v redis-cli &> /dev/null; then
  echo "⚠️  redis-cli 未安装，跳过连接检查"
else
  if redis-cli ping &> /dev/null; then
    echo "✅ Redis 连接正常"
  else
    echo "⚠️  Redis 未运行，部分测试可能失败"
    echo "   启动 Redis: redis-server"
  fi
fi

echo ""
echo "======================================"
echo "运行测试"
echo "======================================"
echo ""

# 运行所有测试
echo "📊 运行完整测试套件..."
npm test -- --verbose

echo ""
echo "======================================"
echo "测试覆盖率"
echo "======================================"
echo ""

# 生成覆盖率报告
echo "📈 生成覆盖率报告..."
npm test -- --coverage --coverageDirectory=coverage

echo ""
echo "======================================"
echo "✅ 测试完成"
echo "======================================"
echo ""
echo "覆盖率报告：file://$(pwd)/coverage/index.html"
echo ""

# 运行特定测试文件（可选）
if [ "$1" == "--file" ] && [ -n "$2" ]; then
  echo "🎯 运行特定测试文件：$2"
  npm test -- "$2" --verbose
fi
