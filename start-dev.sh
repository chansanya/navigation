#!/bin/bash

echo "🚀 启动 Nav 开发环境..."
echo ""
echo "📝 使用说明："
echo "  - 前端: http://localhost:5173"
echo "  - 后端 API: http://localhost:8788"
echo "  - 管理员令牌: 在 .dev.vars 中配置，参考 .dev.vars.example"
echo ""
echo "⚠️  需要两个终端窗口："
echo "  终端1: npm run dev (前端开发服务器)"
echo "  终端2: npm run pages:dev (Pages Functions API)"
echo ""
echo "按 Ctrl+C 停止..."
echo ""

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
fi

if [ ! -f ".dev.vars" ]; then
  echo "⚠️  未检测到 .dev.vars，请参考 .dev.vars.example 创建本地环境变量文件"
fi

# 检查数据库是否初始化
D1_STATE_DIR=".wrangler/state/v3/d1"
if ! find "$D1_STATE_DIR" -name "*.sqlite" -type f -print -quit 2>/dev/null | grep -q .; then
  echo "🗄️  初始化数据库..."
  npx wrangler d1 execute navigation_db --local --file=./db/schema.sql
fi

echo "✅ 准备完成！"
echo ""
echo "请手动运行以下命令："
echo "  终端1: npm run dev"
echo "  终端2: npm run pages:dev"
