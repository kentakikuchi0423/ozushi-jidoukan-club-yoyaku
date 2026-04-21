# 大洲市児童館クラブ予約システム

愛媛県大洲市の以下3施設のクラブ予約を行うための Web システム。

- 大洲児童館
- 喜多児童館
- 徳森児童センター

利用者はブラウザからクラブを予約でき、管理者は権限に応じてクラブの登録・編集・アカウント管理を行う。

## ドキュメント

| 目的 | ファイル |
| --- | --- |
| プロジェクト憲章 / Claude Code への指示 | [CLAUDE.md](./CLAUDE.md) |
| タスクと進捗 | [TASKS.md](./TASKS.md) |
| 現在地と次の一手 | [STATUS.md](./STATUS.md) |
| 要件詳細 | [docs/requirements.md](./docs/requirements.md) |
| アーキテクチャ | [docs/architecture.md](./docs/architecture.md) |
| 未確定事項 | [docs/open-questions.md](./docs/open-questions.md) |
| 採用した設計判断 (ADR) | [docs/decisions.md](./docs/decisions.md) |
| テスト戦略 | [docs/testing-strategy.md](./docs/testing-strategy.md) |
| セキュリティレビュー | [docs/security-review.md](./docs/security-review.md) |

## 現在地

- **Phase 1（開発基盤）**: 完了
- **Phase 2（DB / 認証 / 権限）**: 進行中
  - Supabase プロジェクト作成済み、初期スキーマの migration 適用済み
  - 予約番号・secure token のドメインロジックと unit test 整備済み
  - 認証 / 権限 enforcement は未着手

進捗の詳細は [STATUS.md](./STATUS.md) を参照。

## 技術スタック

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS v4（必要に応じて shadcn/ui を Phase 3 で導入予定）
- Supabase (PostgreSQL / Auth / RLS) — DB と管理者認証
- Resend — メール送信（Phase 3 以降）
- Vercel — ホスティング（Phase 6 付近）
- Vitest — ユニットテスト
- Playwright — E2E テスト

採用理由と制約は [docs/decisions.md](./docs/decisions.md) の ADR を参照。

## 開発環境

VS Code devcontainer を用意している。VS Code の「Reopen in Container」でコンテナ内開発を開始できる。corepack で pnpm が有効化される。

Playwright のブラウザは devcontainer 初期化後に一度だけ:

```bash
pnpm exec playwright install chromium
sudo $(which pnpm) exec playwright install-deps chromium
```

## セットアップ

1. `.env.example` を `.env.local` にコピーし、各値を埋める
   - Supabase の `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`
   - 2025-11 以降の新規 Supabase プロジェクトは publishable / secret キーのみ発行される（ADR-0012）
   - `SUPABASE_DB_URL` は Supabase Studio の **Session pooler (port 5432)** 接続文字列。IPv4 環境では必須（ADR-0013）
2. `pnpm install`
3. `pnpm db:push` — 未適用の migration があればリモート DB に反映

## コマンド

```bash
pnpm dev            # 開発サーバー (http://localhost:3000)
pnpm build          # 本番ビルド
pnpm start          # ビルド後の本番サーバー
pnpm lint           # ESLint (Next.js core-web-vitals + TypeScript + Prettier 互換)
pnpm typecheck      # tsc --noEmit
pnpm format         # Prettier で書き換え
pnpm format:check   # Prettier の差分確認のみ
pnpm test           # Vitest (jsdom、単体)
pnpm test:watch     # Vitest watch
pnpm test:e2e       # Playwright (build → start → test)
pnpm db:push        # supabase/migrations/ を $SUPABASE_DB_URL に反映
```

## ディレクトリ構成

```
.
├── src/
│   ├── app/                    # Next.js App Router（利用者画面 + 管理画面）
│   ├── lib/                    # UI 非依存のドメインロジック（client / server 共用）
│   │   ├── facility.ts
│   │   └── reservations/
│   └── server/                 # server-only（secret key を参照するもの、Web Crypto 等）
│       └── reservations/
├── supabase/
│   ├── config.toml             # Supabase CLI プロジェクト設定
│   ├── migrations/             # 20260421000000_initial_schema.sql など
│   └── seed.sql                # 開発用 seed（個人情報は入れない）
├── scripts/
│   └── db-push.mjs             # pnpm db:push のラッパ
├── e2e/                        # Playwright
├── docs/                       # 要件・アーキ・ADR・未確定事項・テスト方針・セキュリティ
└── .claude/                    # Claude Code のエージェント・スキル・設定
```

## Git リモート

remote 未設定。GitHub 公開リポジトリを作成した後、以下で設定する。

```bash
git remote add origin git@github.com:<owner>/ozushi-jidoukan-club-yoyaku.git
git push -u origin main
```

公開前に **secrets が含まれていないこと**、**個人情報を含む fixture が無いこと** を `git log -p` でレビューする。

## ライセンス

未定（Phase 6 までに決定予定）。
