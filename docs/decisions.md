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

- **Status**: Accepted（2026-04-22）
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

## ADR-0016 利用者向けメールはテキスト + HTML の multipart で送る

- **Status**: Accepted（2026-04-25）
- **Context**:
  - 当初は text-only で送っていたが、URL がメーラ次第ではクリック不可になり予約確認画面に遷移できないケースがあった。
  - また Outlook 系・キャリアメール系での見栄えが乏しく、児童館予約という対象に対して信頼感に欠ける。
- **Decision**:
  - 利用者向け 4 テンプレ（confirmed / waitlisted / promoted / canceled）は **テキスト + HTML を併送**（multipart）。
  - HTML は `src/server/mail/templates/shared.ts` の構造化レンダラ（`EmailContent` / `Block` 型）から機械生成し、テキスト版と同一の構造データから派生させる（差分ドリフト防止）。
  - HTML はインラインスタイルで Outlook を含む主要メーラ互換性を確保。`<table>` レイアウト、CTA は緑のボタン + 同じ URL の文字列を併記、フォントは Hiragino Sans / Meiryo。
  - 文面は冒頭に「このメールは予約システムから自動送信しています。」を固定で出し、フッターは全館の連絡先のみ（自動送信注記の重複を避ける）。
  - 利用者向けメールに保護者氏名による挨拶（「○○ 様」）は含めない。汎用文面で十分なため。
- **Consequences**:
  - テンプレートは 1 度の構造データ宣言で両方のレンダラを通すため、保守性が高い。
  - `RenderedEmail.html` は optional。管理者招待（admin-invite）は別系統で `textToHtml` 経由の簡易 HTML を提供。

## ADR-0017 要素リセットは Tailwind の `@layer base` 内に書く

- **Status**: Accepted（2026-04-25）
- **Context**:
  - 当初 `globals.css` に `a { color: inherit }` 等を **unlayered** で書いていたが、Tailwind v4 の `@layer utilities` よりも CSS カスケードで優先されてしまい、`<Link>`（=`<a>`）に付けた `text-white` が打ち消される現象が発生した。
  - 結果、「予約する」「クラブを新規登録」等のプライマリ `<a>` ボタンが本文 foreground を inherit して低コントラスト（約 2.25:1）になり WCAG AA 違反に。
- **Decision**:
  - `globals.css` の要素セレクタリセット（html / body / h1-h4 / a / ::selection）を `@layer base { ... }` 内に収める。
  - これにより Tailwind の `@layer utilities` が要素ルールより優先されるカスケード順となり、utility クラスが期待どおり効く。
  - 同時に primary 色を AA 基準（4.5:1）以上を満たす `#4f7668` に深色化。
- **Consequences**:
  - 今後追加する要素レベルのスタイルも必ず `@layer base` 内に書く。
  - 配色は CSS 変数（`--color-*`）を介して集中管理し、各コンポーネントは `var(--color-...)` を読むだけ。

## ADR-0018 館マスターは DB で動的管理する（ハードコード廃止）

- **Status**: Accepted（2026-04-24）
- **Context**:
  - v0 では `src/lib/facility.ts` に 3 館（ozu / kita / toku）と日本語名・予約番号 prefix がハードコードされていた。
  - 新しい館の追加・名称変更・電話番号変更にコード修正と再デプロイが必要で、運用負担になる。
  - 大洲市側でも将来的な施設追加・統合・名称変更が想定される。
- **Decision**:
  - `facilities` テーブルに `phone` 列と `deleted_at` を追加（migration 20260424000003）し、館マスターを完全に DB 管理化。
  - `code` の制約は `text check (code ~ '^[a-z0-9_]+$')` に変更（小文字英数字とアンダースコアのみ）。
  - super_admin だけが `/admin/facilities` から CRUD できる。新館を追加すると、その時点で全館権限を持っている既存 super_admin に新館権限を自動付与する（`findSuperAdminIdsToGrant` 純粋関数で判定）。
  - `src/lib/facility.ts` には `FACILITY_CODE_REGEX` / `isFacilityCodeFormat` のフォーマット検証だけを残す。
- **Consequences**:
  - 新館の追加が画面操作だけで完結する。
  - メールフッタの連絡先列挙は `fetchActiveFacilityContacts()` でランタイム取得する。
  - 旧来の `code in ('ozu','kita','toku')` の DB 制約は撤廃済み。

## ADR-0019 クラブと事業（program）は別テーブルにする

- **Status**: Accepted（2026-04-24）
- **Context**:
  - 当初 `clubs` 1 テーブルに「クラブ名・対象年齢・概要・開催日時・定員」を全部持たせていた。
  - 同じ事業（例: 「こども英会話初級」）を月に何度も開催するため、クラブを作るたびに同じ説明文を入力する負担があった。
  - 検索・絞り込みも事業単位でやりたい要望があった。
- **Decision**:
  - 事業マスター `club_programs`（id / name / target_age / summary / deleted_at）を新設（migration 20260424000000）。
  - `clubs` から `program_id uuid not null references club_programs(id) on delete restrict` で参照。
  - クラブには「その回固有の補足」として `description` だけを残す（事業共通の概要は `programs.summary`）。
  - 事業 CRUD は全 admin が利用可能（`/admin/programs`）。
- **Consequences**:
  - クラブ登録フォームでは事業選択 + 日時 + 定員 + 補足 だけになり、入力負担が減る。
  - 利用者一覧では `club_programs` を JOIN して名称・対象年齢・概要を表示する（`get_public_club` / `list_public_clubs` RPC）。
  - 事業を削除しようとして `clubs` から参照されていれば DB 制約で拒否される（事故防止）。

## ADR-0020 クラブの公開状態は `published_at` で表現する

- **Status**: Accepted（2026-04-24）
- **Context**:
  - クラブを作った直後すぐ利用者一覧に出ると、入力ミスのまま見えてしまうリスクがある。
  - 一方で「下書き／公開」の boolean だと「いつ公開されたか」の情報が失われる。
- **Decision**:
  - `clubs.published_at timestamptz` を追加（migration 20260424000002）。`null` は下書き、タイムスタンプが入ると公開中。
  - 管理画面の「公開する」ボタンが `published_at = now()` をセット（idempotent）。
  - `list_public_clubs` / `get_public_club` RPC は `published_at is not null` を必須条件にする。
  - 管理画面では未公開クラブも一覧に出し、バッジで「下書き」表示する。
- **Consequences**:
  - 公開操作が監査ログ `club.publish` に残る。
  - 「いつから公開」の情報が DB に保持され、運用上のトレーサビリティが取れる。

## ADR-0021 管理者キャンセル導線は専用 RPC + 確認画面で実装する

- **Status**: Accepted（2026-04-26）
- **Context**:
  - 当初は「Phase 4 では作らない」としていたが、運用上「電話問い合わせ → 管理者がキャンセル」のフローが頻発する想定が立った。
  - 既存の `cancel_reservation` RPC は `(reservation_number + secure_token)` を要求する利用者向け関数で、admin は token を持たないためそのままでは流用できない。
- **Decision**:
  - 新 RPC `admin_cancel_reservation(p_reservation_id uuid)` を追加(migration 20260425000000)。
    - SECURITY DEFINER、`grant execute` は `service_role` のみ（Server Action 経由でのみ呼べる）。
    - 認可は Server Action 側（`requireFacilityPermission`）で対象館の権限を確認してから呼ぶ。
    - キャンセル + waitlist 先頭の繰り上げを 1 トランザクションで実施。idempotent（再呼び出しは canceled=false の no-op）。
  - UI は予約者一覧（`/admin/clubs/[id]/reservations`）の active な予約に「キャンセルする」ボタンを置き、押下で確認画面（`/admin/reservations/[id]/cancel`）へ遷移。確認画面で「キャンセルメール送信」「waitlist 繰り上げ通知」「取り消し不可」を明示してから submit させる。
  - メールテンプレートは利用者キャンセルと同じ `canceled` / `promoted` を流用（受信者目線では予約が消えた事実は同じで、文面を分ける必要がない）。
  - 監査ログは `reservation.admin_cancel`、metadata に `previousStatus` / `promoted` / `idempotentNoop` を残す（個人情報は含めない）。
  - 締切（2 営業日前 17 時）の判定は admin 経路では行わない。締切後の運用は管理者キャンセルが主動線。
- **Consequences**:
  - 締切後でも管理者は強制キャンセルできるため、無連絡欠席や日程変更に対応可能。
  - 利用者が受け取るメールは「セルフキャンセル時」と区別がつかない。違いを示したい場合は `notifyReservationCanceled` に `by` フラグを足してテンプレ分岐できる（v1 では分岐しない）。

## ADR-0023 予約番号の 6 桁部分は館別シーケンスで採番する

- **Status**: Accepted（2026-04-27）
- **Context**:
  - 予約番号は人間可読・全体ユニーク・再利用しないことが固定要件（CLAUDE.md）
  - 候補は 2 つあった: 案A（館別の通し番号 100000 → 999999）／案B（6 桁ランダム + 衝突時リトライ）
  - 案B はランダム性で「予約件数が外から推測されない」利点があるが、衝突確率対応で実装が複雑になる
  - 推測困難性は既に `secure_token`（ADR-0004）で担保しており、予約番号自体が漏れても他人予約にアクセスできない
- **Decision**:
  - **案A: 館別の通し番号（100000 → 999999）** を採用
  - 館ごとに専用テーブル `reservation_number_sequences (facility_id, next_value)` を持ち、`create_reservation` RPC 内で `UPDATE ... RETURNING` の原子更新でシーケンスを払い出す（衝突なし）
  - 番号フォーマット: `<facility_code>_<6-digit>`（例: `ozu_123456`）。`RESERVATION_NUMBER_REGEX = /^([a-z][a-z0-9]{1,9})_(\d{6})$/`
  - `next_value` の CHECK は `100000..1000000`、実払い出しは `100000..999999`
  - 上限到達時の対応手順は ADR-0030 にまとめる（現実的にはほぼ起きない想定）
- **Consequences**:
  - 番号順 = 申込順 で人間にとって直感的
  - 「予約件数が外から推測される」点は許容（公開リスクとして低い）
  - 1 年経過後の retention cleanup で空いた番号も **再利用しない**（古い確認メールに残る番号と新番号が衝突して UX が混乱するため。CLAUDE.md 固定要件）

## ADR-0024 写真 URL は http/https のみ許可、protocol/host のみ検証する

- **Status**: Accepted（2026-04-27）
- **Context**:
  - クラブ登録時の写真 URL は管理者が任意の外部 URL（Google Drive 共有リンク等）を貼る運用
  - `javascript:` 等の危険スキームを通すと XSS 経路になりうる
  - 一方で外部ホストの allowlist を最初から持つと、新しいストレージサービスを使うたびに運用変更が必要
- **Decision**:
  - **http / https スキームのみ許可**（`/^https?:\/\//` の prefix 検証 + `new URL().protocol` で再確認）
  - **host の allowlist は持たない**（必要性が出た段階で追加検討）
  - レンダリング側は `<a target="_blank" rel="noopener noreferrer">` を必須（`src/app/clubs/[id]/page.tsx`、`src/components/clubs/club-card.tsx` で実装済み）
  - 入力検証は `src/lib/clubs/input-schema.ts`、表示時の二重防御は `hasValidPhotoUrl()`（`src/lib/clubs/types.ts`）
- **Consequences**:
  - `javascript:` / `data:` / `file:` 等の危険スキームは zod とランタイムの両方で弾く
  - 外部ホストの不正 URL（マルウェア配布サイト等）まではこのレイヤでは弾けない。運用で「館内で確認済みの URL のみ貼る」を徹底する前提
  - 将来 host allowlist が必要になったときは `hasValidPhotoUrl` に集約されているので 1 箇所改修で済む

## ADR-0025 予約待ちの上限は持たず無制限とする

- **Status**: Accepted（2026-04-27）
- **Context**:
  - 「定員の N 倍まで」のような上限を設ける案もあったが、児童館規模のイベントで実害が出るほどの待ち列にはならない
  - 上限を超えた利用者を弾くフローを実装すると、UI / メール文面 / RPC エラーハンドリングまで影響範囲が広い
- **Decision**:
  - 予約待ちの上限は **設けない**（無制限）
  - `create_reservation` RPC は満員の場合 `coalesce(max(waitlist_position), 0) + 1` で末尾に追加するだけ（`supabase/migrations/20260422000000_reservation_rpcs.sql`、`20260423000000_multi_parent_child.sql`）
- **Consequences**:
  - 予約待ち番号が大きくなるリスクはあるが、運用上は問題にならない見込み
  - 万一「予約待ち 100 人超え」のような実害が出た場合は、別 ADR で上限導入を再検討する
  - 待ちリスト順位の整合は ADR-0022（キャンセル時の再採番）でカバー

## ADR-0026 同一保護者の重複予約は許容し、警告は当面実装しない

- **Status**: Accepted（2026-04-27）
- **Context**:
  - 当初は「兄弟姉妹で別々に申し込むケース」を想定して複数回予約を許容しつつ、UX として「同一メール + 同一クラブ」の重複に警告を出す案だった
  - その後の実装で `children` 配列（migration 20260423000000）が導入され、1 予約に複数の子を入れられるようになった結果、「兄弟は 1 予約にまとめる」が正解パスとして成立している
  - 一方で「同一メール + 同一クラブ」での重複自体は DB 制約・RPC・フォームのいずれでも弾いていない
- **Decision**:
  - **複数回予約は許容**（DB 制約は追加しない）
  - **重複時の UX 警告も当面は実装しない**
  - 兄弟が同時参加する場合は `children` 配列に複数子を入れる運用を案内する（利用者マニュアル側で誘導）
- **Consequences**:
  - 二重送信や入力ミスによる重複予約は通る。実害が出れば管理者キャンセル導線（ADR-0021）でリカバリ可能
  - 定員消費の無駄は出うる。観測したうえで再評価する
- **再評価のトリガー条件**（以下が観測されたら別 ADR で警告 UI / DB 制約を再検討）:
  - 管理者から「重複予約の手動キャンセル依頼が月に複数件」の声
  - retention cleanup 前の DB で同一クラブ・同一 parent email の active 重複が定員圧迫レベル
  - 二重送信事故が同一ユーザーから複数報告される

## ADR-0022 キャンセル時に待ちリストの順位を詰め直す

- **Status**: Accepted（2026-04-26）
- **Context**:
  - 当初の `cancel_reservation` / `admin_cancel_reservation` は、キャンセル対象の `waitlist_position` を null にするだけで、後ろの待ち列の順位を更新していなかった。
  - 結果として、待ちリスト `{1, 2, 3}` の 2 番目がキャンセルした後も、3 番目は `waitlist_position = 3` のまま残り、UI に「3 番目」と表示され続けるバグになっていた。
  - 利用者からも「自分の前の人がキャンセルしたはずなのに順位が変わらない」という違和感の訴えが出る筋。
- **Decision**:
  - migration 20260426000000 で共通ヘルパー `renumber_waitlist_after_gap(club_id, gap_position)` を新設し、`cancel_reservation` / `admin_cancel_reservation` の末尾から呼び出す。
    - 元が `waitlisted` のキャンセル → ギャップは旧 `waitlist_position`
    - 元が `confirmed` のキャンセル + 先頭繰り上げあり → ギャップは 1（先頭の位置）
    - それ以外 → 何もしない
  - ヘルパー本体は PL/pgSQL の FOR ループで `waitlist_position` 昇順に 1 行ずつ `waitlist_position - 1` で UPDATE する。一括 UPDATE ではなく **昇順 1 行ずつ** にするのは、`(club_id, waitlist_position)` の partial unique index に対して中間状態の重複を避けるため。
  - メール通知は **送らない**（順位変動のたびにメールが届くと煩わしい。利用者は予約確認 URL を再訪したときに最新の順位が見えれば十分）。送るのは引き続き、繰り上げ確定（waitlisted → confirmed）になった先頭の人にだけ。
- **Consequences**:
  - 予約確認画面・予約者一覧・admin キャンセル確認画面のいずれも DB 値を素直に表示するだけで正しい順位になる（アプリ側のロジック修正は不要）。
  - 同一クラブで複数人が同時にキャンセルしても、`reservations FOR UPDATE` + `clubs FOR UPDATE`（confirmed の場合）で直列化されるため整合する。
  - 万一一括 UPDATE に変更したくなった場合は、deferrable な UNIQUE constraint への移行が必要（partial unique index は deferrable にできないため、CREATE UNIQUE INDEX を ALTER TABLE ADD CONSTRAINT に置き換える等の追加作業がいる）。

## ADR-0027 監査ログは 3 年保持を運用ガイドラインとする

- **Status**: Accepted（2026-04-27）
- **Context**:
  - 個人情報を含まない監査ログ（ログイン成功/失敗、クラブ CRUD、招待・削除、admin cancel、retention cleanup など）は調査用途で 1 年以上残しておきたい
  - retention cleanup（`/api/cron/retention-cleanup`）は現状クラブ・予約のみが対象で、`audit_logs` は対象外（無期限累積）
  - 個人情報は含めない原則（`docs/security-review.md` §3）が前提のため、長期保持しても法的リスクは低い
  - DB 容量への影響は軽微（1 行あたり 1〜2 KB のテキスト）
- **Decision**:
  - **監査ログは 3 年保持** を運用ガイドラインとする
  - 自動削除は v1 では実装しない。3 年経過後の取り扱いは運用担当者が判断する（手動削除 or retention 拡張の追加 ADR）
  - `audit_logs` の DB 容量が運用上問題になった段階で、retention cleanup を `audit_logs` に拡張する別 ADR で対応する
- **Consequences**:
  - launch から 3 年は何も触る必要がない
  - 容量監視は Supabase ダッシュボードで十分（個別アラートは設けない）
  - 個人情報を含めない原則を引き続き厳守する（`audit_logs.metadata` に氏名・電話・メール本文を入れない）

## ADR-0028 利用者画面は WCAG 2.1 AA 相当を目標とする

- **Status**: Accepted（2026-04-27）
- **Context**:
  - 大洲市の公的サービスとして、保護者が幅広い環境で使えることが望ましい
  - JIS X 8341-3 / WCAG 2.1 AA は日本の自治体サイトで広く使われている目標値
  - AAA まで上げると実装制約が大きく、launch スピードと釣り合わない
- **Decision**:
  - 利用者画面は **WCAG 2.1 AA 相当** を目標とする
  - 重点項目: コントラスト比（4.5:1 以上）、フォントサイズ、キーボード操作（focus visible）、フォームのラベル、エラー表示、`<a target="_blank">` の `rel="noopener noreferrer"`
  - Phase 6 のテスト工程で観点別の手動チェックを行い、`docs/acceptance-tests.md` のチェック項目で軽く回帰できるようにする
  - 管理者画面は同等の心がけはするが、内部利用者向けなので AA 完全準拠は要求しない
- **Consequences**:
  - ADR-0017（Tailwind `@layer base` 化、primary 色 `#4f7668` の AA 化）は本 ADR の前段にあたる
  - 改善余地が見つかった場合は別 ADR を起こさず、Phase 6 / 運用後の改善 PR で対応する

## ADR-0029 リポジトリは private スタート、Phase 6 終盤で public 切替する

- **Status**: Accepted（2026-04-27、2026-04-28 に MIT ライセンス選択を明記）
- **Context**:
  - Claude Code を主体に開発しているため、初期 commit に試行錯誤の痕跡や、誤って test secrets が混入するリスクがある
  - 一方で、自治体の予約システムとして将来的に public で参照される価値（同種システムの参考実装になる）はある
  - public 切替時にライセンスが付いていないと、法的には "all rights reserved" 扱いになり README に書いた「他地域への流用」が成立しない
- **Decision**:
  - 開発期間中は **private** で運用
  - Phase 6 終盤（テスト / セキュリティ / 仕上げ完了時点）で **`git log` 全 commit を diff レビュー** し、secret 混入がないことを確認
  - 確認後に GitHub Settings から **public 切替** を行う
  - ライセンスは **MIT** を採用（`LICENSE` ファイル + `package.json` の `"license"` フィールド + `README.md §ライセンス` の 3 点で表明）。理由は (1) 自治体システムとしての透明性、(2) 同種の児童館・施設予約システムへの転用容易性、(3) 依存ライブラリ群（Next.js / Supabase JS / Resend SDK 等）と互換のもっともゆるい OSS ライセンス
- **Consequences**:
  - public 切替前のチェックリストは `docs/security-review.md` に該当節を維持する
  - public 切替時点までは secret は GitHub Actions secrets / Vercel env / `.env.local` のみで管理し、コミットしない
  - public 切替自体は GitHub の Settings 操作のみで完結する（コードへの影響なし）
  - ライセンス変更（MIT 以外への切替）が必要になった場合は別 ADR を起こして全 contributor の同意を取り直す

## ADR-0030 予約番号 6 桁の上限到達時は 7 桁拡張で対応する

- **Status**: Accepted（2026-04-27）
- **Context**:
  - 予約番号は `<facility_code>_<6-digit>` 形式（ADR-0023）
  - `reservation_number_sequences` の CHECK は `100000..1000000`、実払い出しは `100000..999999` の 900,000 番／館
  - スケール感: 1 日 50 予約・年中無休でも約 49 年、1 日 10 予約で約 246 年で **現実的に到達しない**
  - 番号は再利用しない原則（CLAUDE.md 固定要件）。retention cleanup で空いた番号も再利用しない（古い確認メールに残る番号と新番号の衝突回避）
- **Decision**:
  - **平時は何もしない**。上限到達が見えてきた時点で 7 桁に拡張する
  - 検知シグナル: サーバログの `reservation_number_sequences_next_value_check` CHECK 違反エラー
  - 拡張は新規 migration 1 本 + アプリ側 3 ファイル改修で完結する想定（下記手順）
- **対応手順（参考、上限到達時に実施）**:
  1. **migration 追加**: `next_value` の上限と `reservations.reservation_number` の CHECK を緩める
     ```sql
     alter table public.reservation_number_sequences
       drop constraint reservation_number_sequences_next_value_check;
     alter table public.reservation_number_sequences
       add constraint reservation_number_sequences_next_value_check
         check (next_value between 100000 and 10000000);

     alter table public.reservations
       drop constraint reservations_reservation_number_check;
     alter table public.reservations
       add constraint reservations_reservation_number_check
         check (reservation_number ~ '^[a-z][a-z0-9]+_[0-9]{6,7}$');
     ```
  2. **`create_reservation` RPC の `lpad` 桁数調整**: 旧 6 桁番号と新 7 桁番号を両立させたい場合は `lpad` をやめて `to_char(v_allocated_seq, 'FM999999999')` 等の可変桁に変更（または「上限到達後は 7 固定」で `lpad(..., 7, '0')` でも可）
  3. **`src/lib/reservations/number.ts`**:
     - `RESERVATION_NUMBER_SEQUENCE_MAX = 9_999_999`
     - `RESERVATION_NUMBER_REGEX = /^([a-z][a-z0-9]{1,9})_(\d{6,7})$/`
     - `buildReservationNumber` の桁判定（必要なら `lpad` 相当を調整）
  4. **テスト更新**: `number.test.ts` に 7 桁ケースを追加
  5. **デプロイ**: 通常の Vercel デプロイで反映。DB migration は `pnpm db:push`
- **Consequences**:
  - 1 館だけ先に到達しても他館には影響しない（sequence は館別）
  - 旧 6 桁番号は永続的に有効。利用者の手元の確認メールは引き続き機能する
  - secure_token の長さは変更しないので URL 互換性は保たれる

## ADR-0031 Server Action ログでは現行の `code / message / hint` パターンを維持する

- **Status**: Accepted（2026-04-28）
- **Context**:
  - `src/app/clubs/[id]/actions.ts` ほか複数箇所の `console.error` で `error.message` をログに含めている。`docs/security-review.md` §4 では「code / message / hint を許容、details は除外」を方針として明記
  - 理論的な懸念として、PG エラーの一部（`22P02` invalid input syntax / `22001` value too long など）は `message` 自体に offending value（利用者が入力した phone / email など）が含まれる可能性がある
  - ただし zod が事前に厳格な検証を行っており、CHECK 制約と zod の regex がズレた場合にしか発生しない。さらに `details` は明示的に除外しているため、CHECK 違反で値が漏れる経路はほぼ閉じている
- **Decision**:
  - **現状維持**。`console.error` には引き続き `tag / code / message / hint` を含める方針を維持する
  - 理由: (1) `details` 除外で主要な PII 漏れ経路は塞がっている、(2) `message` を除外すると debug 性が大きく落ちる、(3) zod による事前検証で実用上の発生確率は極めて低い、(4) Sentry 等のエラートラッキング導入時に `beforeSend` で PII マスクする既存方針（security-review §4）でカバーできる
- **Consequences**:
  - 既存コードに変更なし
  - 将来 Sentry / Datadog 等を導入する際は `beforeSend` で `message` のサニタイズフィルタを必ず通す（既存方針の継続）
  - zod スキーマと DB CHECK の整合性は引き続き厳密に保つ（現状すでに一致）

## ADR-0032 公開クラブ一覧は二次キー `c.id desc` で安定ソートする

- **Status**: Accepted（2026-04-28）
- **Context**:
  - 公開クラブ一覧の ORDER BY は `c.start_at desc` のみ（migration `20260424000002_clubs_published_at.sql`）
  - CLAUDE.md 固定要件「クラブ一覧は **日付降順・時間降順**」は `start_at`（timestamptz）1 列で表現できているが、同一 `start_at` のクラブが複数登録された場合（同時刻開催の隣館同士など）、表示順が undefined になる
  - 実用上の影響は小さいが、E2E テストの安定性やページング導入時の予測可能性のため、決定的な順序が望ましい
- **Decision**:
  - migration `20260428000000_list_public_clubs_stable_sort.sql` で `list_public_clubs` を `ORDER BY c.start_at desc, c.id desc` に変更
  - `get_public_club(uuid)` は単一行を返すので変更不要
- **Consequences**:
  - 同一 `start_at` のクラブの表示順が UUID 降順で決定的になる（人間の意図的な序列ではないが、安定）
  - アプリ側コードへの影響なし（戻り値型・WHERE 句は同一）
  - migration 数: 16 → 17

## ADR-0033 ログイン失敗 5 回／30 分でアラートメールを送る

- **Status**: Accepted（2026-04-28）
- **Context**:
  - 管理者ログインは Supabase Auth の email + password。失敗は `audit_logs.admin.login.failed` に email / IP / reason 付きで全件記録済み（`src/app/admin/login/actions.ts`）
  - Supabase Auth 自体に IP ベースのレート制限はあるが、「身に覚えのないログイン試行」を本人に気付かせる経路は無い
  - 一方で素朴に「N 回失敗で常にメール」だと、(a) 攻撃者が任意アドレスへ通知爆撃をかけられる、(b) 当社ドメインから第三者にスパムを送る踏み台にされる、(c) アカウント凍結だと意図的な締め出し（DoS）が可能、という別リスクが入る
- **Decision**: 以下の制約付きでアラートメール送信を実装する。
  - **閾値**: 同一メールアドレスについて、直近 **30 分** に `admin.login.failed` が **5 件以上** 蓄積した時点で 1 通送信（業界一般・OWASP ASVS V11 / NIST SP 800-63B 帯）
  - **宛先制限**: `admins` テーブルに存在するメールに **限る**。未登録メールには絶対に送らない（踏み台防止 + Resend の評判保護）
  - **cool-down**: 同一メールに対し直近 **24 時間** に `admin.login.alert_sent` が記録されていればスキップ（通知爆撃防止）
  - **アカウント凍結はしない**: 通知のみ。意図的な DoS の入口を作らない
  - **本文方針**: IP・時刻の詳細は本文に書かない（PII 最小化、`docs/security-review.md` §4 の方針継続）。「複数回のログイン失敗を検知しました／心当たりがなければパスワード変更を／心当たりがなくても緊急性は低い旨」だけ案内
  - **記録**: 送信した場合は `audit_logs` に `admin.login.alert_sent`（metadata: `{ email, threshold, window_minutes }`）を残す。未登録 / cool-down 中でスキップした場合は **記録しない**（cool-down の判定はスキップしなかった「送信した」記録に対してのみ行う）
  - **発火タイミング**: `loginAction` の失敗パスで `admin.login.failed` を記録した直後に fire-and-forget。本人ログイン UX を待たせない
- **Consequences**:
  - Resend 使用量増は最大でも「1 アカウント × 1 通 / 24h」。無料枠（100 通/日）に対して攻撃下でも余裕
  - Supabase Auth の既定レート制限と合わせ、`docs/security-review.md` §3 の「Brute Force（管理者ログイン）」が「済（最小限）」→「済」に格上げ可能
  - メールテンプレ追加で `architecture.md §6` のテンプレ数 5 → 6
  - 30 分窓の query は `audit_logs.created_at` インデックスで間に合う想定。失敗ログは元々レアなので追加 index は不要
- **再評価のトリガー**:
  - 5 回未満でも本人から「身に覚えのないログイン試行が頻発」と申告がある（誤打鍵による誤発火が多すぎる場合は閾値を上げる、または検知が遅すぎる場合は下げる）
  - ログイン失敗の規模が「audit_logs クエリが遅い」レベルに達した場合は `(action, created_at desc)` 部分インデックスを追加
