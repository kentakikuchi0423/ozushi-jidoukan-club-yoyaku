# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 2 継続・認証方針確定 + Supabase クライアント + 権限ガード）

### 今セッションでやったこと
- **Q1 / Q11 を決定 → ADR-0014 / ADR-0015 を追加**:
  - ADR-0014: 管理者認証は Supabase Auth の email/password 方式。ID = メールアドレス。セッションは `@supabase/ssr` の cookie ベース、有効期限は Supabase 既定（access 1h + refresh 自動）、アイドル 24h で強制ログアウト。MFA は v1 なし。
  - ADR-0015: Supabase クライアントを 3 種に分離し、`import "server-only"` で boundary を明示:
    - `src/lib/supabase/browser.ts` — client components 用（publishable key）
    - `src/lib/supabase/server.ts` — RSC / Route Handler / Server Action 用（publishable key + cookies）
    - `src/server/supabase/admin.ts` — secret key で RLS バイパス、server-only
  - `docs/open-questions.md` から Q1 / Q11 を「決定済み」に移動
- **依存追加**: `@supabase/ssr@0.10.2` / `@supabase/supabase-js@2.104.0` / `server-only@0.0.1`
- **環境変数モジュールを二層化（fail-fast）**:
  - `src/lib/env.ts` — `NEXT_PUBLIC_*` のみ。client 同梱可
  - `src/server/env.ts` — `SUPABASE_SECRET_KEY` を server-only で読む。未設定時はアプリ起動時に throw
- **Supabase クライアント 3 種を実装**:
  - `createSupabaseBrowserClient()` — `@supabase/ssr` の `createBrowserClient`
  - `createSupabaseServerClient()` — Next.js `cookies()` と連携。Server Component からの呼び出しでは cookie 書き込みを try/catch で握りつぶし
  - `getSupabaseAdminClient()` — 特権操作用。モジュール内でキャッシュ
- **権限ユーティリティ実装**（`src/server/auth/`）:
  - `permissions.ts` — `computeIsSuperAdmin` / `hasFacilityPermission`（純粋ロジック）+ `fetchAdminFacilityCodes`（DB、admin クライアント経由）
  - `session.ts` — `getCurrentAdminId()` で Supabase Auth セッションから uid を取得
  - `guards.ts` — `requireAdmin` / `requireFacilityPermission` / `requireSuperAdmin`。失敗時は型付き Error（`AuthenticationRequiredError` / `FacilityPermissionDeniedError` / `SuperAdminRequiredError`）を throw
  - unit test: 5 ケース追加（純粋関数のみ。DB 依存は Phase 6 の integration test で）
- **Vitest を `server-only` + env に対応**:
  - `vitest.server-only-stub.ts` を作り、`vitest.config.ts` の resolve alias で `server-only` → スタブに差し替え
  - `vitest.setup.ts` でダミー env を `??=` で注入し、`.env.local` が無いテスト環境でも env fail-fast が通るように
- **ローカルパイプライン all green**:
  - `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test`（4 files / **24 tests passed**）/ `pnpm build` 全て exit 0

### 現在地
- **Phase 2 は 65%**。DB スキーマ + 認証基盤 + 権限ガードまで完成。
- ログイン画面・ミドルウェア・管理系 RPC・audit_logs 書き込みラッパが残り。
- 「admin がログインでき、自館のクラブだけ見える最小ループ」は Phase 4（管理画面）に入る前の踏み台として、次セッションで middleware + bootstrap seed 用意まで進めたい。

### 次にやること（Phase 2 残り → Phase 4 準備）
1. Next.js middleware（`src/middleware.ts`）で `/admin/*` を `@supabase/ssr` の session 更新に通す。未ログイン時は `/admin/login` へリダイレクト。
2. `src/server/audit/` を作り、`logAdminAction(action, target)` 相当を admin クライアントで INSERT。`audit_logs` RLS は service role しか書けないので問題なし。
3. 予約確定・採番・繰り上げ RPC（Postgres function、`SECURITY DEFINER`）を追加 migration として追加し、`pnpm db:push` で反映。
4. `src/server/reservations/` に `allocateReservationNumber(code)` を追加（薄い RPC ラッパ）。
5. Phase 3 に向けて、利用者側のクラブ一覧 SELECT を `@/lib/supabase/server` 経由で書き、レンダリングの骨格だけ作る。
6. 初期 super_admin の bootstrap 手順を docs/architecture.md か新ドキュメントにまとめる（Supabase Studio で `auth.users` 手動作成 → `admins` / `admin_facilities` 挿入）。

### ブロッカー / 未確定
- **Resend アカウントとドメイン認証**（Phase 3 時にユーザー操作が必要）
- **GitHub リモート未設定**（Phase 6 前に `gh repo create` を依頼予定）
- 初期 super_admin の作成手順はまだユーザーが実行していない。ログイン画面ができた段階で docs/seed 手順を示す

### 直近コマンド結果
- `pnpm format:check`: All matched files use Prettier code style!
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 4 files / **24 tests passed**
- `pnpm build`: Compiled successfully (Next.js 16.2.4)
- `pnpm db:push`: Remote database is up to date.
- `pnpm test:e2e`: 未実行（今回 UI 無変更のため）

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションのコミット予定:
  - ADR-0014 / ADR-0015 + Supabase クライアント + 認証/権限ガード（後続のコミットで作成）
