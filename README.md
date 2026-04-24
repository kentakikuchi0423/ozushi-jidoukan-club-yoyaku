# 大洲市児童館クラブ予約システム

愛媛県大洲市の児童館・児童センター（現時点は **大洲児童館 / 喜多児童館 / 徳森児童センター** の 3 館、将来追加可能）でのクラブ予約をまとめて扱う Web システムです。

- 保護者は **スマートフォンやパソコン** から、空き状況を見て予約・キャンセルができます
- 管理者（児童館職員）は **自分の館のクラブ** を登録・編集し、参加者名簿を確認できます
- 全館管理者だけが **館マスター（連絡先）** と **管理者アカウント** を追加・削除できます

## 3 分で把握する全体像

```
  利用者（保護者）                           管理者（児童館職員）
   │                                           │
   ▼                                           ▼
  クラブ一覧（/）                      /admin/login → /admin/clubs
   │                                           │
   ▼                                           ▼
  予約フォーム（/clubs/[id]）         クラブ CRUD / 予約者確認 / 館管理
   │                                           │
   ▼                                           │
  予約完了メール ◀──  Resend ◀────  Server Action （監査ログ + DB）
   │
   ▼
  予約確認・キャンセル（/reservations?r=...&t=...）
```

### 本番を立てるのに必要な外部サービス

| サービス | プラン目安 | 役割 |
| --- | --- | --- |
| [Supabase](https://supabase.com) | **Free** で開始可能 | Postgres + Auth + RLS |
| [Vercel](https://vercel.com) | **Hobby** で十分 | Next.js ホスティング + Cron |
| [Resend](https://resend.com) | **Free** + 独自ドメイン | 予約確認メール送信 |
| 独自ドメイン | 年 1,000 円〜 | 本番公開 URL + Resend 送信元 |

無料枠の範囲で動き始められます。Resend の送信元は独自ドメインを検証する必要があります（未検証の間はアカウント所有メールにしか送れません）。

### 本番セットアップの 6 ステップ

1. **Supabase プロジェクト作成** — Region は Tokyo 推奨（`docs/operations.md §1`）
2. **Vercel にリポジトリ連携** — GitHub push で自動デプロイ
3. **環境変数を登録** — Supabase 3 点 + `SUPABASE_DB_URL` + `NEXT_PUBLIC_SITE_URL` + Resend + `CRON_SECRET`（`docs/operations.md §9-3`）
4. **Migration 適用** — `pnpm db:push`（`docs/operations.md §2, §9-4`）
5. **初期 super_admin を作成** — Supabase Studio で SQL（`docs/operations.md §3, §9-5`）
6. **動作確認** — `docs/acceptance-tests.md` の 18 シナリオ（`docs/operations.md §9-6`）

各ステップは `docs/operations.md` §1〜§11 に、つまずきやすい箇所も含めて写真なしで詳述しています。

## ドキュメント索引

| 対象 / 目的 | ファイル |
| --- | --- |
| **保護者向けマニュアル** | [`docs/user-manual.md`](./docs/user-manual.md) |
| **管理者向けマニュアル** | [`docs/admin-manual.md`](./docs/admin-manual.md) |
| マニュアル索引 | [`docs/manual-index.md`](./docs/manual-index.md) |
| 運用手順（本番 runbook / 監査ログ / Resend） | [`docs/operations.md`](./docs/operations.md) |
| 受入テスト（リリース前の 18 シナリオ） | [`docs/acceptance-tests.md`](./docs/acceptance-tests.md) |
| 要件詳細 | [`docs/requirements.md`](./docs/requirements.md) |
| アーキテクチャ（DB / RLS / 認証 / メール） | [`docs/architecture.md`](./docs/architecture.md) |
| 採用した設計判断 (ADR) | [`docs/decisions.md`](./docs/decisions.md) |
| 未確定事項 | [`docs/open-questions.md`](./docs/open-questions.md) |
| テスト戦略 | [`docs/testing-strategy.md`](./docs/testing-strategy.md) |
| セキュリティレビュー | [`docs/security-review.md`](./docs/security-review.md) |
| プロジェクト憲章 / Claude Code への指示 | [`CLAUDE.md`](./CLAUDE.md) |
| タスクと進捗 | [`TASKS.md`](./TASKS.md) |
| 現在地と次の一手 | [`STATUS.md`](./STATUS.md) |

## 技術スタック

- **Next.js 16** (App Router) + React 19 + TypeScript strict
- **Tailwind CSS v4**（`src/app/globals.css` に CSS 変数でテーマ定義、和みパステル）
- **Supabase**（PostgreSQL / Auth / RLS、Session pooler 経由で migration）
- **Resend** — 予約通知メール
- **zod** — server / client 二重入力検証
- **date-fns-tz + @holiday-jp/holiday_jp** — JST 業務日計算
- **Vercel** — ホスティング + Cron（retention cleanup）
- **Vitest** — ユニットテスト
- **Playwright** — E2E テスト

採用理由と制約は [`docs/decisions.md`](./docs/decisions.md) の ADR を参照。

## 開発環境

VS Code devcontainer を用意しています。VS Code の「Reopen in Container」でコンテナ内開発を開始できます。corepack で pnpm が有効化されます。

Playwright のブラウザは devcontainer 初期化後に一度だけ:

```bash
pnpm exec playwright install chromium
sudo $(which pnpm) exec playwright install-deps chromium
```

## ローカルセットアップ（はじめに動かす）

1. `.env.example` を `.env.local` にコピーし、各値を埋める
   - **必須**: Supabase 3 点（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`）、`SUPABASE_DB_URL`（Session pooler port 5432）、`NEXT_PUBLIC_SITE_URL`
   - **任意**: `RESEND_API_KEY` / `RESEND_FROM_ADDRESS`（メールを実際に送る場合）、`CRON_SECRET`（Cron を叩く場合）
2. `pnpm install`
3. `pnpm db:push` — 未適用の migration がリモート DB に反映されます
4. [`docs/operations.md §3`](./docs/operations.md) に従い、初期 super_admin を Supabase Studio で作成
5. `pnpm dev` で `http://localhost:3000` を開く

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

### opt-in の重い E2E（実 DB を書き換えます）

```bash
# 利用者フロー: 予約 → 完了 → キャンセル
RUN_RESERVATION_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/reservation-flow.spec.ts

# 管理フロー: ログイン → クラブ CRUD → 館 CRUD → ログアウト
RUN_ADMIN_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/admin-flow.spec.ts

# 待ちリスト → 繰り上がり（capacity=1 クラブと E2E_WAITLIST_CLUB_ID が必要）
RUN_WAITLIST_E2E=1 E2E_WAITLIST_CLUB_ID=<id> PORT=3100 pnpm test:e2e e2e/reservation-flow.spec.ts

# 非 super_admin の権限境界（2 人目の admin が必要）
RUN_PERMISSION_E2E=1 PORT=3100 pnpm test:e2e e2e/permission-guard.spec.ts
```

## よくあるつまずき（FAQ）

### `pnpm db:push` が SASL authentication failed で失敗する

- `SUPABASE_DB_URL` は **Session pooler（ポート 5432）** の接続文字列を使ってください（`pooler.supabase.com:5432`）。Direct connection（`db.<ref>.supabase.co:5432`）や Transaction pooler（6543）では本プロジェクトの migration は動きません
- 詳細は ADR-0013（`docs/decisions.md`）

### Resend から送ったメールが届かない

- 送信元ドメインがまだ Resend で検証されていない場合、Resend アカウント所有のメールにしか届きません。`docs/operations.md §9-7` の手順で SPF / DKIM / DMARC を登録してください
- 相手の迷惑メールフォルダも一度確認してください

### Vercel の Cron が 401 を返す

- Vercel の **Production environment** に `CRON_SECRET` が設定されているかを確認してください（Preview / Dev にも設定していないとプレビュー環境で叩けません）
- ログは Vercel の Functions → `/api/cron/retention-cleanup` から確認できます

### `/admin/login` でログインできない

- Supabase Studio → **Authentication → Users** で対象 email の `email_confirmed_at` が埋まっているかを確認してください。未確認の場合、`docs/operations.md §3` の SQL で確認済みにするか、招待メールのリンクを踏んで完了させます
- パスワード自体に記号や全角が混ざっていないかもご確認ください
- 失敗が続くと Supabase 側で一時的にレート制限が掛かります。5〜10 分待ってから再試行

### `pnpm test` でワーカータイムアウトが数件出る

- Vitest 4 のスレッドワーカーが稀に立ち上がらない既知 flake です。失敗したファイルだけ `pnpm exec vitest run <path>` で個別に回すと通ります
- 本番には影響しません

## ディレクトリ構成

```
.
├── src/
│   ├── app/
│   │   ├── (利用者)                 # /, /clubs/[id], /clubs/[id]/done, /reservations
│   │   ├── admin/                   # /admin, /admin/login, /admin/clubs/*, /admin/password, /admin/accounts, /admin/facilities, /admin/programs
│   │   ├── api/cron/                # /api/cron/retention-cleanup
│   │   └── globals.css              # テーマ変数（CSS 変数）
│   ├── components/
│   │   ├── ui/                      # Button / Input / Field / Badge / Card / FormMessage 等の UI プリミティブ
│   │   └── clubs/                   # ClubCard / FilterBar / PaginatedClubList
│   ├── lib/                         # UI 非依存のドメイン（server/client 共用）
│   │   ├── clubs/                   # 型、query、input-schema
│   │   ├── facility.ts              # FACILITY_CODE_REGEX + isFacilityCodeFormat（動的マスター）
│   │   ├── format.ts                # JST 日時フォーマッタ
│   │   ├── reservations/            # 予約番号、status、入力スキーマ、キャンセル締切
│   │   └── supabase/                # browser / server クライアント（publishable）
│   └── server/                      # server-only（SUPABASE_SECRET_KEY 参照）
│       ├── auth/                    # session, permissions, guards, profile, admin-list, super-admin
│       ├── audit/                   # logAdminAction
│       ├── clubs/                   # fetchClubForAdmin / admin-list / programs
│       ├── env.ts                   # secret key + Resend + CRON_SECRET
│       ├── facilities/              # fetchFacilities / fetchActiveFacilityContacts
│       ├── mail/                    # Resend wrapper + 5 templates + notify
│       ├── reservations/            # create / cancel / lookup / secure-token / admin-list
│       └── supabase/admin.ts        # secret key クライアント
├── supabase/
│   ├── config.toml
│   ├── migrations/                  # DB スキーマ + RPC + retention + facilities 動的化
│   └── seed.sql
├── scripts/db-push.mjs              # `pnpm db:push` ラッパ
├── e2e/                             # Playwright
├── docs/                            # 要件・アーキ・ADR・運用・テスト・セキュリティ・マニュアル
├── vercel.json                      # Cron 設定
└── .claude/                         # Claude Code のエージェント・スキル・設定
```

## Git リモート / デプロイ

remote は各プロジェクトで任意に設定してください。初回デプロイ手順は [`docs/operations.md §9`](./docs/operations.md) に「本番デプロイ runbook」として一気通しで記載しています（GitHub 作成 → Vercel 連携 → env 投入 → migration → 初期 super_admin → 動作確認チェックリスト → Resend ドメイン切替）。

公開前に **secrets が含まれていないこと**、**個人情報を含む fixture が無いこと** を `git log -p` でレビューしてください。

## ライセンス

[MIT License](./LICENSE)。

「大洲市児童館クラブ予約システム」として大洲市内の利用を想定していますが、同じ仕組みを他地域の施設予約でも流用しやすいよう MIT ライセンスで公開しています。二次利用時はご自身の運用環境・法規制に合わせてご確認ください。
