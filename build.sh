#!/bin/bash

# 模拟构建过程
echo "开始构建项目..."
echo "创建 dist 目录..."
mkdir -p dist

echo "复制文件到 dist 目录..."
cp -r index.html dist/
cp -r src/ dist/

echo "构建完成！"
echo "项目已构建到 dist 目录"
