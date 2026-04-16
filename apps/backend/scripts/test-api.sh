#!/bin/bash

# Phase 2 API 快速测试脚本

BASE_URL="http://localhost:3001/api"
TENANT_ID="test-tenant-id"

echo "🧪 Phase 2 API 测试"
echo "=================="

# 1. 健康检查
echo ""
echo "1️⃣  健康检查..."
curl -s "$BASE_URL/health" | jq .

# 2. 创建知识库
echo ""
echo "2️⃣  创建知识库..."
KB_RESPONSE=$(curl -s -X POST "$BASE_URL/knowledge-bases" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "name": "测试知识库",
    "description": "Phase 2 API 测试"
  }')

echo "$KB_RESPONSE" | jq .

KB_ID=$(echo "$KB_RESPONSE" | jq -r '.data.id')
if [ "$KB_ID" == "null" ] || [ -z "$KB_ID" ]; then
    echo "❌ 创建知识库失败"
    exit 1
fi
echo "✅ 知识库 ID: $KB_ID"

# 3. 获取知识库列表
echo ""
echo "3️⃣  获取知识库列表..."
curl -s "$BASE_URL/knowledge-bases?x-tenant-id=$TENANT_ID" | jq .

# 4. 获取知识库详情
echo ""
echo "4️⃣  获取知识库详情..."
curl -s "$BASE_URL/knowledge-bases/$KB_ID" \
  -H "x-tenant-id: $TENANT_ID" | jq .

# 5. 创建问答对
echo ""
echo "5️⃣  创建问答对..."
curl -s -X POST "$BASE_URL/knowledge-bases/$KB_ID/qa-pairs" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "question": "如何重置密码？",
    "answer": "您可以通过以下方式重置密码：...",
    "category": "账户管理",
    "tags": ["密码", "账户"]
  }' | jq .

# 6. 获取问答对列表
echo ""
echo "6️⃣  获取问答对列表..."
curl -s "$BASE_URL/knowledge-bases/$KB_ID/qa-pairs" \
  -H "x-tenant-id: $TENANT_ID" | jq .

# 7. 知识检索（需要有文档数据）
echo ""
echo "7️⃣  知识检索..."
curl -s -X POST "$BASE_URL/knowledge-bases/$KB_ID/search" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "query": "密码重置",
    "topK": 5
  }' | jq .

# 8. 获取文档列表（应该是空的）
echo ""
echo "8️⃣  获取文档列表..."
curl -s "$BASE_URL/knowledge-bases/$KB_ID/documents" \
  -H "x-tenant-id: $TENANT_ID" | jq .

# 9. 获取知识片段列表
echo ""
echo "9️⃣  获取知识片段列表..."
curl -s "$BASE_URL/knowledge-bases/$KB_ID/chunks" \
  -H "x-tenant-id: $TENANT_ID" | jq .

# 10. 删除知识库
echo ""
echo "🗑️  清理：删除知识库..."
curl -s -X DELETE "$BASE_URL/knowledge-bases/$KB_ID" \
  -H "x-tenant-id: $TENANT_ID" | jq .

echo ""
echo "=================="
echo "✅ API 测试完成！"
echo ""
echo "📚 完整 API 文档：http://localhost:3001/api-docs"
