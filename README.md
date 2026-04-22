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
| 運用（bootstrap / retention / メール / Cron） | [docs/operations.md](./docs/operations.md) |

## 現在地

- **Phase 1（開発基盤）**: 完了
- **Phase 2（DB / 認証 / 権限）**: 95%（残: RPC integration test、Phase 6 に回す）
- **Phase 3（利用者画面）**: 95%（予約作成→確認→キャンセル、メール、締切チェック、E2E まで通過）
- **Phase 4（管理画面）**: 75%（ログイン / ダッシュボード / クラブ CRUD / パスワード変更 / アカウント招待、E2E 済み）
- **Phase 5（予約待ち・繰り上げ・期限管理）**: 80%（RPC・メール・締切・retention cron 済み。Integration test は Phase 6）
- **Phase 6（仕上げ）**: 30%（セキュリティレビュー整理、ヘッダー、E2E、Cron、docs）

進捗の詳細は [STATUS.md](./STATUS.md) を参照。

## 技術スタック

- **Next.js 16** (App Router) + React 19 + TypeScript strict
- **Tailwind CSS v4**
- **Supabase**（PostgreSQL / Auth / RLS、Session pooler 経由で migration）
- **Resend** — 予約通知メール
- **zod** — server / client 二重入力検証
- **date-fns-tz + @holiday-jp/holiday_jp** — JST 業務日計算
- **Vercel** — ホスティング + Cron（retention cleanup）
- **Vitest** — ユニットテスト
- **Playwright** — E2E テスト

採用理由と制約は [docs/decisions.md](./docs/decisions.md) の ADR を参照。

## 開発環境

VS Code devcontainer を用意している。VS Code の「Reopen in Container」でコンテナ内開発を開始できる。corepack で pnpm が有効化される。

Playwright のブラウザは devcontainer 初期化後に一度だけ:

```bash
pnpm exec playwright install chromium
sudo $(which pnpm) exec playwright install-deps chromium
```

## セットアップ

1. `.env.example` を `.env.local` にコピーし、各値を埋める。必須のもの:
   - Supabase 3 点（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`）
   - `SUPABASE_DB_URL`（Session pooler (port 5432) 形式、ADR-0013）
   - `NEXT_PUBLIC_SITE_URL`（予約確認 URL のベース）
2. オプション:
   - `RESEND_API_KEY` / `RESEND_FROM_ADDRESS`（未設定でもアプリは動く）
   - `CRON_SECRET`（Vercel デプロイ後に設定、未設定時は `/api/cron/*` が 503）
   - 初回 super_admin 作成用の `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`
3. `pnpm install`
4. `pnpm db:push` — 未適用の migration がリモート DB に反映される
5. [docs/operations.md §3](./docs/operations.md) に従い、初期 super_admin を Supabase Studio で作成

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

### opt-in の重い E2E

```bash
# 利用者フロー（予約→完了→キャンセル、実 DB に書き込む）
RUN_RESERVATION_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/reservation-flow.spec.ts

# 管理フロー（ログイン→クラブ新規登録→編集→削除→ログアウト）
RUN_ADMIN_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/admin-flow.spec.ts
```

## ディレクトリ構成

```
.
├── src/
│   ├── app/
│   │   ├── (利用者)                 # /, /clubs/[id], /clubs/[id]/done, /reservations
│   │   ├── admin/                   # /admin, /admin/login, /admin/clubs/*, /admin/password, /admin/accounts
│   │   ├── api/cron/                # /api/cron/retention-cleanup
│   │   └── middleware.ts            # 全ルートで Supabase セッション refresh + /admin/* ガード
│   ├── lib/                         # UI 非依存のドメイン（server/client 共用）
│   │   ├── clubs/                   # ClubListing 型、query、input-schema
│   │   ├── facility.ts              # 3 館コード / ID マップ
│   │   ├── format.ts                # JST 日時フォーマッタ
│   │   ├── reservations/            # 予約番号、status、入力スキーマ、キャンセル締切
│   │   └── supabase/                # browser / server クライアント（publishable）
│   └── server/                      # server-only（SUPABASE_SECRET_KEY 参照）
│       ├── auth/                    # session, permissions, guards, profile, admin-list
│       ├── audit/                   # logAdminAction
│       ├── clubs/                   # fetchClubForAdmin
│       ├── env.ts                   # secret key + Resend + CRON_SECRET
│       ├── mail/                    # Resend wrapper + 4 templates + notify
│       ├── reservations/            # create / cancel / lookup / secure-token
│       └── supabase/admin.ts        # secret key クライアント
├── supabase/
│   ├── config.toml
│   ├── migrations/                  # DB スキーマ + RPC + retention
│   └── seed.sql
├── scripts/db-push.mjs              # `pnpm db:push` ラッパ
├── e2e/                             # Playwright
├── docs/                            # 要件・アーキ・ADR・運用・テスト・セキュリティ
├── vercel.json                      # Cron 設定
└── .claude/                         # Claude Code のエージェント・スキル・設定
```

## Git リモート / デプロイ

remote 未設定。GitHub 公開リポジトリを作成した後、以下で設定する。

```bash
git remote add origin git@github.com:<owner>/ozushi-jidoukan-club-yoyaku.git
git push -u origin main
```

公開前に **secrets が含まれていないこと**、**個人情報を含む fixture が無いこと** を `git log -p` でレビューする。

Vercel デプロイ時の環境変数・Cron 設定は [docs/operations.md](./docs/operations.md) §4 / §6 を参照。

## ライセンス

未定（Phase 6 の最終確認で決定）。
