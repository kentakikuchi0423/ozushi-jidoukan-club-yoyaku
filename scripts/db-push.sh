#!/usr/bin/env bash
# `pnpm db:push` 経由で呼ばれるラッパ。
#
# 目的:
#   Supabase Personal Access Token（アカウント全権限）を使わず、
#   プロジェクト固有の DB 接続文字列で migration を反映する。
#   詳細は docs/decisions.md の ADR-0013。
#
# 前提:
#   リポジトリ直下の .env.local に SUPABASE_DB_URL が設定されていること。
#   Supabase Studio > Project Settings > Database > Connection string の
#   URI をコピーし、[YOUR-PASSWORD] を実際の DB パスワードに置換する。
#
# 実行例:
#   pnpm db:push                       # すべての未適用 migration を反映
#   pnpm db:push -- --dry-run          # 何が流れるか確認だけ
#   pnpm db:push -- --include-all      # 既適用分も含め流し直す（注意）

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: $ENV_FILE が見つかりません。.env.example を複製してください。" >&2
  exit 1
fi

# .env.local を読み込む（set -a で export 付きにする）。
set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL が .env.local に設定されていません。" >&2
  echo "       .env.example のコメントを参照し、Project Settings > Database" >&2
  echo "       の接続文字列を貼り付けてください。" >&2
  exit 1
fi

cd "$ROOT"
exec pnpm exec supabase db push --db-url "$SUPABASE_DB_URL" "$@"
