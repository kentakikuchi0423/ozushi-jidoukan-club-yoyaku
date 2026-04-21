# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-21

### 今セッションでやったこと
- **devcontainer / settings 軽微修正を先にコミット**（`6901905`）。`$localEnv:HOME` 依存の mount 削除と settings schema URL の安定化。
- **Phase 1（開発基盤）を完了**:
  - `pnpm dlx create-next-app@latest` でスキャフォールド（Next.js 16.2 / React 19 / Tailwind v4 / App Router / src-dir / `@/*` alias / Turbopack 無効）。
    - create-next-app が自動導入するバージョンが Next.js 16 になっていたため、`docs/decisions.md` の ADR-0001 は「15 or later」に読み替えるか後日更新する（本セッションでは実績バージョンを `CLAUDE.md` と本 STATUS に記録するに留める）。
  - 開発依存を追加: prettier / prettier-plugin-tailwindcss / eslint-config-prettier / vitest / @vitejs/plugin-react / @vitest/coverage-v8 / @testing-library/react / @testing-library/jest-dom / jsdom / @playwright/test
  - Playwright ブラウザ (chromium) と Linux の system deps を devcontainer にインストール（`playwright install-deps chromium`）。
  - `package.json` に `typecheck` / `format` / `format:check` / `test` / `test:watch` / `test:e2e` スクリプトを追加。
  - `.prettierrc.json` / `.prettierignore`（docs/.claude は対象外）を追加。
  - `eslint.config.mjs` に `eslint-config-prettier` を追加（フォーマット系ルールを無効化）。
  - `src/app/layout.tsx`: `lang="ja"` / Noto Sans JP / メタデータ（title template・noindex）/ Viewport を設定。
  - `src/app/page.tsx`: Phase 1 段階のプレースホルダ画面（3館チップ + 管理者ログイン導線の placeholder リンク）。
  - `src/lib/facility.ts` + `src/lib/facility.test.ts`: 3館コード/名前のマスタと型ガード。Vitest の単体テスト 3 ケース。
  - `e2e/smoke.spec.ts`: build → start 経由で動作する Playwright smoke（見出し + 3館 listitem + `html[lang=ja]`）。
  - `playwright.config.ts`: webServer を `pnpm build && pnpm start`、timeout 300s、`PLAYWRIGHT_BASE_URL` で上書き可。
  - `vitest.config.ts` + `vitest.setup.ts`: jsdom / `@testing-library/jest-dom/vitest` / `@/*` alias / coverage (v8)。
  - `.env.example`: Supabase / Resend / NEXT_PUBLIC_SITE_URL / admin bootstrap のプレースホルダ。
  - `CLAUDE.md` に「コマンド」「アーキテクチャ」セクションを追記。
- **動作確認（すべて exit 0）**:
  - `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（3 tests passed）、`pnpm build`（4 pages / all static）、`pnpm test:e2e`（2 tests passed, chromium）。

### 現在地
- **Phase 1（開発基盤）完了**。`src/` にアプリ本体が存在し、ローカルの全パイプラインが green。
- 次は **Phase 2: DB / 認証 / 権限**。Supabase プロジェクトがまだ作成されていないため、先にユーザー操作依頼が発生する。

### 次にやること（Phase 2 に向けて）
1. **[ユーザー操作]** Supabase プロジェクトを作成し、`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を `.env.local` に設定する（`.env.example` 参照）。
2. `docs/architecture.md` のスキーマ案を最終化（`facilities` / `clubs` / `reservations` / `admins` / `admin_facilities` / `audit_logs`、ENUM・一意制約・インデックス）。
3. SQL migration を `supabase/migrations/` に作成（初期化スクリプト + seed）。
4. 管理者認証（Supabase Auth ベース、ADR-0001 候補）を server-side で固定する入口を `src/server/` に作る。
5. 館ごとの権限 enforcement ユーティリティと、監査ログ書き込みのラッパを追加。
6. 予約番号採番・予約確定 RPC（ADR-0004 / ADR-0005）の unit test を Vitest で。
7. `docs/decisions.md` の ADR-0001 を「Next.js 15 or later」と読み替える、もしくは実績の 16 を追記する。

### ブロッカー / 未確定
- **Supabase プロジェクト未作成**（ユーザー操作が必要）。`.env.local` に値が入らないと Phase 2 の統合テストが書けない。
- **Resend アカウントとドメイン認証**（Phase 3 時）。
- **GitHub リモート未設定**（公開準備ができたら `gh repo create` を依頼予定）。
- Playwright ブラウザと system deps は **今回の devcontainer インスタンスに手動で追加** した。別の devcontainer インスタンスや CI 環境では `bash .devcontainer/post-create.sh` → `pnpm exec playwright install chromium` → `sudo $(which pnpm) exec playwright install-deps chromium` が必要。
- `docs/open-questions.md` に 13 件の未確定事項が残る（主に Phase 2 以降の仕様確認）。

### 直近コマンド結果
- `pnpm format:check`: `All matched files use Prettier code style!`
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 1 file / 3 tests passed
- `pnpm build`: Compiled successfully / 4 static pages
- `pnpm test:e2e`: 2 tests passed (chromium)

### Git
- ブランチ: `main`
- リモート: 未設定
- ローカル user 設定を今回のコンテナに対してのみ追加（既存履歴の identity に一致）
- 前セッション末以降のコミット:
  - `6901905` chore(devcontainer): remove HOME-dependent mount, update settings schema URL
  - (Phase 1 実装コミット予定)
