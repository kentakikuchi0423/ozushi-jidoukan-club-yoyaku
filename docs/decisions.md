# decisions

採用した設計判断を ADR（Architecture Decision Record）形式で記録する。
撤回する場合は該当 ADR を **Status: Superseded** にし、理由を追記する。

---

## ADR-0001 Next.js 15+ (App Router) + TypeScript を採用する

- **Status**: Accepted（2026-04-21, Phase 1 で実績を反映）
- **Context**: フロント・API 双方を一つで持て、Vercel との親和性が高い。CLAUDE.md で Next.js + TS が前提
- **Decision**: Next.js 15+ (App Router) を採用。Server Actions / Route Handlers を使い分ける。
  - Phase 1 実装時点（2026-04-21）では `create-next-app@latest` が導入する **Next.js 16.2 / React 19.2 / Tailwind CSS v4** を採用した。したがって「15 系以降」を広く許容する（後方互換のために 15 へ戻すことはしない）
- **Consequences**:
  - RSC の学習コスト。Server Action でのトランザクション処理パターンを docs に整理する
  - Next.js 16 系のデフォルト（Turbopack・ルーティング挙動）に準じ、Phase 1 では Turbopack を無効化せずに標準設定で進める

## ADR-0002 Supabase + Resend + Vercel を初期構成にする

- **Status**: Accepted（2026-04-21）
- **Context**: 低コスト、保守性、スマホ対応重視。無料枠で試せる
- **Decision**: Supabase（PostgreSQL + Auth）、Resend（メール）、Vercel（ホスティング）を初期採用
- **Consequences**: Supabase の RLS に慣れる必要。将来の移行は SQL + ORM 層を薄く保つことで対応

## ADR-0003 パッケージマネージャは pnpm

- **Status**: Accepted（2026-04-21）
- **Context**: 速度 / ディスク効率 / lockfile の厳格さ
- **Decision**: pnpm を採用。`corepack` で devcontainer 内に pin
- **Consequences**: Vercel で `pnpm` を明示する必要。`pnpm-lock.yaml` を必ずコミット

## ADR-0004 予約番号は `prefix_6桁` + 内部 secure_token の二重構造

- **Status**: Accepted（2026-04-21）
- **Context**: 人間可読性と推測困難性を両立。URL 直叩きでの他人予約アクセス防止
- **Decision**:
  - `reservation_number`（例: `ozu_123456`）は人間可読・ユニーク・再利用しない
  - `secure_token`（32文字以上の crypto-random）を別カラムで持つ
  - 予約確認 URL は `?r={number}&t={token}` の形で両方を要求
  - メールにのみ URL を記載
- **Consequences**: 実装時は「必ず token 一致を verify する」ユーティリティを一本化

## ADR-0005 予約確定はサーバー側の DB トランザクション + 行ロック

- **Status**: Accepted（2026-04-21）
- **Context**: 同時予約で定員超過しないことが要件
- **Decision**: `clubs` 行を `SELECT ... FOR UPDATE` で取得後、現在の confirmed 件数を数えて status を決定
- **Consequences**: `pg` の行ロック挙動に依存。Supabase の RPC（stored function）として書き、Service Role からのみ呼ぶ

## ADR-0006 利用者予約確認 URL 経由でのみ予約詳細にアクセス可能

- **Status**: Accepted（2026-04-21）
- **Context**: 個人情報保護。予約番号だけでは他人の予約に触れない
- **Decision**: 予約確認画面は `reservation_number + secure_token` の両方必須。secure_token はメールにのみ記載
- **Consequences**: 将来、電話問い合わせ窓口を作る場合の本人確認フローは別途設計

## ADR-0007 館権限は admin_facilities の多対多で管理する

- **Status**: Accepted（2026-04-21）
- **Context**: 1 admin が複数館を担当するケースがある。super_admin は「3館全て持つ admin」として定義
- **Decision**: `admin_facilities` テーブルで多対多。`is_super_admin` のブールフラグは持たず、権限集合から判定
- **Consequences**: 「super_admin」判定ユーティリティを server-side に一本化する

## ADR-0008 monorepo / multi-package にしない

- **Status**: Accepted（2026-04-21）
- **Context**: 規模が小さい。保守性と実装速度優先
- **Decision**: 単一 Next.js アプリの中で `src/lib`, `src/server` で関心を分離
- **Consequences**: 将来もし admin と user を別デプロイに分けたくなったら Turborepo 化を検討

## ADR-0009 テストは Vitest（unit）+ Playwright（E2E）

- **Status**: Accepted（2026-04-21）
- **Context**: テスト方針は docs/testing-strategy.md
- **Decision**: Vitest でドメインロジックと API、Playwright で主要導線を E2E
- **Consequences**: Playwright MCP で対話的 UI 確認も可能にする

## ADR-0010 タイムゾーンは Asia/Tokyo 固定

- **Status**: Accepted（2026-04-21）
- **Context**: 地域固有サービス、DB は timestamptz、表示は JST
- **Decision**: UI 表示と業務日判定は `Asia/Tokyo`。DB は UTC 保存（timestamptz）。日付計算には `date-fns-tz` を使う
- **Consequences**: ビジネスデイ計算（キャンセル期限判定）は必ず JST で行う

## ADR-0012 Supabase 新 API キー方式（publishable / secret）を採用する

- **Status**: Accepted（2026-04-21）
- **Context**: 2025-11-01 以降に作成された Supabase プロジェクトでは、従来の `anon` / `service_role` キーは発行されず、代わりに `sb_publishable_...` / `sb_secret_...` のみが提供される。本プロジェクトは今まさに作成するため、新方式に寄せる
- **Decision**:
  - 環境変数名は以下に統一
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（旧 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 相当、クライアント同梱可・RLS 適用）
    - `SUPABASE_SECRET_KEY`（旧 `SUPABASE_SERVICE_ROLE_KEY` 相当、サーバー専用・RLS バイパス）
  - `SUPABASE_SECRET_KEY` には必ず `NEXT_PUBLIC_` を付けない。`src/server/` の server-only モジュール経由でのみ参照する
  - supabase-js への引き渡し方は旧キーと同じ（第2引数の `key` に値を渡すだけ）。drop-in で互換
  - 旧キー（anon / service_role）を貼り付けても動くが、本プロジェクトは新方式で運用する
- **Consequences**:
  - 古いチュートリアルやスニペットに出てくる `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` をそのままコピペしないよう注意（env 名が変わっている）
  - Supabase Auth Helpers 等の既定 env 名が旧名のままのライブラリを使うときはラッパで吸収する
  - `docs/security-review.md` のチェック項目と `.claude/agents/security-reviewer.md` の lint 観点も新名に更新済み

## ADR-0013 Supabase migration は Personal Access Token を使わず `--db-url` で push する

- **Status**: Accepted（2026-04-21）
- **Context**:
  - `supabase link` + `supabase db push` はデフォルトで Personal Access Token（PAT）を必要とする
  - Supabase の PAT は **アカウント配下の全プロジェクトを API 経由で操作できる強権限** で、プロジェクト単位・読み取り専用に絞る方法が現時点（2026-04）の Supabase ダッシュボードでは提供されていない
  - 一方 `supabase db push --db-url <postgres-uri>` は対象プロジェクトの Postgres 接続のみを必要とし、PAT は不要
- **Decision**:
  - 本プロジェクトの migration 反映は **`--db-url` 経路に統一** する
  - DB 接続文字列は `.env.local` の `SUPABASE_DB_URL` に置き、`pnpm db:push`（`scripts/db-push.sh`）がそれを読み込んで `supabase db push` を起動する
  - 接続先は Session pooler（port 5432）を優先する。Direct connection（`db.<ref>.supabase.co`）は Supabase の現行インフラで IPv6 専用であり、devcontainer / GitHub Actions 等 IPv4 のみの環境から到達できない。Transaction pooler（port 6543）は DDL / prepared statement 周りの互換性問題があるため migration では使わない
  - `supabase link` は任意（ローカル実行での `supabase status` などに便利だが必須ではない）。link 済みでも `db:push` は `--db-url` を明示で渡す
  - CI / 本番 migration 反映も同じパターン（GitHub Actions の secret に `SUPABASE_DB_URL` を入れる）
- **Consequences**:
  - PAT を発行した場合は用途を終えた直後に必ず revoke する運用
  - DB パスワードを万一漏洩した場合は Supabase Studio で即 Reset database password → `SUPABASE_DB_URL` を更新
  - `docs/security-review.md` §5「secrets / 運用」にも方針を追記する

## ADR-0014 管理者認証は Supabase Auth を採用し、ID はメールアドレスとする

- **Status**: Accepted（2026-04-22、open-questions.md Q1 / Q11 の決定内容を取り込み）
- **Context**:
  - 要件では「ID/パスワード」でログインと書かれているが、固有 ID を別に発番する実装コストと、ID を忘れた際の復旧フローが発生する
  - Supabase Auth は email + password、MFA、パスワードリセット、ログイン失敗レート制限などを標準で提供
  - 管理者は数人規模（各館 1〜2 名 + super_admin）であり、自前で同等の機能を安全に作るメリットが薄い
- **Decision**:
  - **Supabase Auth の email/password 方式** を採用し、**ID = メールアドレス** として扱う。UI 文言は「ログイン ID（メールアドレス）」と表記
  - セッションは `@supabase/ssr` を使い Next.js の cookie ベースで管理（HttpOnly / Secure / SameSite=Lax）
  - セッション有効期限は Supabase 既定（access_token 1 時間、refresh_token で自動更新）。アイドル 24 時間で強制ログアウトはミドルウェアで実装する（Phase 4）
  - MFA は v1 では使わない。必要性が出た段階で `supabase.auth.mfa` API で追加（移行パスあり）
  - 新規アカウントは super_admin がダッシュボードから招待する設計（Phase 4）。初期 super_admin のみ Supabase Studio で手動作成し、`.env.local` の `ADMIN_BOOTSTRAP_EMAIL` でハンドリング
  - パスワードリセットと本人によるパスワード変更は Supabase Auth の機能に乗せる
- **Consequences**:
  - `src/server/auth/` は「Supabase のセッション ＝ そのユーザーが admin」という前提で薄く書ける
  - メールアドレスを ID として使うため、個人情報（メール）の取り扱いに要注意。`admins` テーブルに二重に email を持たず、`auth.users` を唯一の真実とする
  - super_admin 判定は ADR-0007 に従い `admin_facilities` で 3 館揃うかで判定する（列フラグは持たない）

## ADR-0015 Supabase クライアントは 3 種に分離し、server-only 境界を明示する

- **Status**: Accepted（2026-04-22）
- **Context**:
  - Supabase には用途の異なる接続方法がある: browser, server (RSC/Route Handler/Server Action), service (secret key で RLS バイパス)
  - それぞれが要件の異なる cookie 処理・キー種別・許可された参照元を持つ
  - secret key を client component から誤って import すると致命的リスクになる
- **Decision**:
  - 3 つのクライアントファクトリを以下のパスで分離する
    - `src/lib/supabase/browser.ts` — `createBrowserClient()`（`@supabase/ssr`）。publishable key を使い、client components からのみ呼ぶ
    - `src/lib/supabase/server.ts` — `createServerClient()`（`@supabase/ssr`、Next.js `cookies()` と連携）。publishable key を使い、RSC / Route Handler / Server Action から呼ぶ。`import "server-only"` で client import を禁止
    - `src/server/supabase/admin.ts` — `createClient()`（`@supabase/supabase-js`）。secret key を使い、RLS をバイパスする管理系 RPC / cron のみで呼ぶ。`import "server-only"` + `src/server/` 配下で二重に隔離
  - env 変数は読み取り層でも分離する
    - `src/lib/env.ts` — `NEXT_PUBLIC_*` のみ（browser 同梱可）
    - `src/server/env.ts` — `SUPABASE_SECRET_KEY` 等 server-only な値。`import "server-only"` 必須
  - 変数不足時はアプリ起動時に **早期に fail fast**（起動後に API コール時に初めて気づく状況を避ける）
- **Consequences**:
  - `src/server/` と `import "server-only"` の規約を CLAUDE.md / README に明記し、今後の PR レビュー観点にする
  - lint ルールは最初は規約どおり書く運用でカバー。後日 `no-restricted-imports` で強制化できる
  - secret key は `src/server/supabase/admin.ts` のみが読む。他からの直接参照はレビューで弾く

## ADR-0011 Git ブランチ戦略: `main` + `feat/*` / `fix/*` / `chore/*`

- **Status**: Accepted（2026-04-21）
- **Context**: 個人開発規模だが、小さく意味ある単位でのコミット指針が必要
- **Decision**:
  - `main` をベースブランチとする
  - 新機能は `feat/<scope>`、バグ修正は `fix/<scope>`、雑務は `chore/<scope>`
  - force push 禁止、履歴書き換え禁止
  - Conventional Commits (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `test: ...`)
- **Consequences**: 初期構築までは `main` で進め、Phase 1 の実装フェーズから feature branch 運用に切替える
