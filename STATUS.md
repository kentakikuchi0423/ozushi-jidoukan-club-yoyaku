# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 2 継続・Supabase CLI 経路の確立 + 軽微リファクタ）

### 今セッションでやったこと
- **Supabase プロジェクト作成 → リモート DB に初期 migration 適用**:
  - ユーザー側で Supabase プロジェクトを作成し、`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` を設定
  - `supabase` CLI を devDependency として導入（`pnpm-workspace.yaml` の `onlyBuiltDependencies` で postinstall を許可）
  - `supabase/config.toml` を `supabase init` で生成
  - `supabase/migrations/20260421000000_initial_schema.sql` を **リモート DB に適用済み**（7 テーブル + RLS + マスタデータ）
- **Personal Access Token 運用を排除**:
  - ADR-0013 として「migration 反映は `--db-url` 経路に統一」を決定
  - `scripts/db-push.mjs`（`pnpm db:push`）を作成
    - `.env.local` を bash `source` ではなくミニ dotenv パーサで読む
    - Supabase CLI が `.env.local` を自動ロードして godotenv でパース失敗する問題を避けるため、**scratch ディレクトリに `supabase/` をシンボリックリンク** して CLI をそこから起動
    - これで `SUPABASE_DB_URL` の値だけが CLI に渡り、`.env.local` 全体の内容は CLI に一切渡らない
  - `.env.example` に IPv4 環境では Session pooler（port 5432）が必須である旨を追記
  - ユーザーが一度発行した PAT は使用後に revoke 済み
- **軽微なリファクタリング（2026-04-22）**:
  - `public/` から create-next-app 由来の未使用 SVG 5 件を削除（`file.svg` / `globe.svg` / `next.svg` / `vercel.svg` / `window.svg`）
  - `README.md` を現状に合わせて全面更新（Phase 進捗、セットアップ、コマンド、ディレクトリ構成）
  - `package.json` に `engines` を追加（Node 20+ / pnpm 10+ をピン）
  - `scripts/db-push.mjs` に SIGINT/SIGTERM 転送を追加し、Ctrl-C 時にも scratch dir が残らないよう改善
- **ローカルパイプライン all green**:
  - `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test`（19 passed）/ `pnpm build` / `pnpm db:push`（`Remote database is up to date.`）すべて exit 0

### 現在地
- **Phase 2 は 40%**。DB スキーマは適用済み、採番・secure token のドメインロジック完成。
- 認証（Supabase Auth）/ Supabase クライアント / 権限 enforcement はこのあと。
- リポジトリの形はベストプラクティスに沿っていることを確認済み（不要ファイル除去・README 最新化）。

### 次にやること（Phase 2 の続き）
1. `docs/open-questions.md` Q1（管理者認証方式）を決定 → **ADR-0014** として `docs/decisions.md` に追加。推奨は Supabase Auth。
2. `@supabase/ssr` と `@supabase/supabase-js` を導入。
3. `src/lib/supabase/` に publishable key クライアント（client components / server components 用）を追加。
4. `src/server/supabase/` に secret key クライアント（server-only）を追加。lint でクライアント import を禁止するコメント + 命名で隔離。
5. `src/server/auth/` に管理者セッション確認 + `requireFacilityPermission` / `requireSuperAdmin` ユーティリティを追加し、unit test をつける。
6. 予約確定・採番・繰り上げを行う RPC（Postgres function）を追加 migration として追加し、`pnpm db:push` で反映。
7. 予約番号 sequence の原子的 UPDATE を薄くラップしたサーバー側関数 `allocateReservationNumber(code)` を `src/server/reservations/` に追加。

### ブロッカー / 未確定
- **Resend アカウントとドメイン認証**（Phase 3 時にユーザー操作が必要）
- **GitHub リモート未設定**（Phase 6 前に `gh repo create` を依頼予定）
- `docs/open-questions.md` の Q1（認証方式）未決定。次セッション冒頭に決める
- Playwright ブラウザと system deps は devcontainer 再作成時に再セットアップ要

### 直近コマンド結果
- `pnpm format:check`: All matched files use Prettier code style!
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 3 files / **19 tests passed**
- `pnpm build`: Compiled successfully (Next.js 16.2.4)
- `pnpm db:push`: Remote database is up to date.
- `pnpm test:e2e`: 未実行（今回 UI 無変更のため）

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションの主要コミット:
  - `89e678e` chore(supabase): add Supabase CLI and initialize config.toml
  - `405ed0c` chore(supabase): switch migration push to --db-url (no PAT needed)
  - `eef74a8` fix(db-push): parse .env.local with a Node mini-dotenv, not bash source
  - `c0f5190` fix(db-push): run supabase CLI from a scratch dir to skip .env.local
  - `325bde7` docs(supabase): require Session pooler for migrations (IPv4 only)
  - （リファクタ本体のコミットは本文更新後に作成）
