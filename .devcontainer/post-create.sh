#!/usr/bin/env bash
set -euo pipefail

# corepack で pnpm を有効化（Node 20 同梱）
corepack enable
corepack prepare pnpm@latest --activate

# Playwright を後から導入するときのシステム依存ライブラリ
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 \
  fonts-noto-cjk fonts-ipafont-gothic fonts-ipafont-mincho
sudo rm -rf /var/lib/apt/lists/*

# package.json があれば依存インストール
if [ -f package.json ]; then
  pnpm install
fi

echo "[post-create] done. timezone=$(cat /etc/timezone 2>/dev/null || date +%Z)"
