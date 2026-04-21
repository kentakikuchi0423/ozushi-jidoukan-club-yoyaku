# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-21（Phase 2 着手・DB 非依存部分）

### 今セッションでやったこと
- **ADR-0001 更新**: `docs/decisions.md` の Next.js バージョン記述を「15+」に広げ、Phase 1 実績の **Next.js 16.2 / React 19.2 / Tailwind CSS v4** を追記。`docs/architecture.md` の技術スタック表も同期。
- **Phase 2 の DB 側設計確定 & SQL migration 作成**:
  - `supabase/migrations/20260421000000_initial_schema.sql` — 7 テーブル（facilities / admins / admin_facilities / clubs / reservations / reservation_number_sequences / audit_logs）+ `reservation_status` ENUM + 全テーブル RLS ON。
    - RLS ポリシーは最小権限で付与し、policy 未定義の組み合わせは `secret key` 経由のみ許可（Supabase の慣例）。
    - `reservations` は直接 SELECT/INSERT を許可せず、後続の `SECURITY DEFINER` 関数（Phase 2 後半）から呼ばせる前提。
    - CHECK 制約で DB 側でも不正データ（予約番号の正規表現、status と waitlist_position / canceled_at の整合、phone/email 形式、photo_url の http(s) プレフィックス、備考 500 字上限）を弾く。
    - インデックスは `clubs_start_at_desc` / `clubs_facility_start_at` / `reservations_club_status` / `reservations_club_waitlist_unique`（partial unique）/ `audit_logs_created_at_desc` / `audit_logs_admin_id`。
    - マスタデータ（facilities 3件、reservation_number_sequences 3件）は migration 内で `insert ... on conflict do nothing`。
  - `supabase/seed.sql` — 開発用 placeholder（個人情報を入れない方針をコメントで明示）。
- **ドメインロジック + unit test**:
  - `src/lib/reservations/number.ts` — `buildReservationNumber` / `parseReservationNumber` / `isReservationNumber` / 正規表現と境界値定数。
  - `src/server/reservations/secure-token.ts` — Web Crypto ベースの `generateSecureToken`（32 バイト → 43 文字 base64url）と `isSecureTokenFormat`。
  - それぞれの `*.test.ts` で 19 ケース（既存 facility 3 + 予約番号 11 + secure token 5）をカバー。
- **ローカルパイプライン all green**:
  - `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test`（19 passed）/ `pnpm build`（4 static pages）すべて exit 0。
  - E2E は今回 UI を触っていないので未実行。

### 現在地
- **Phase 2 は 30%**（DB 側の骨格と予約番号ドメインロジック完了）。
- Supabase プロジェクト未作成のため、migration の **実際の適用確認はユーザー対応待ち**。SQL 自体は Postgres の構文として正しいことを手で確認済み。
- 認証（Supabase Auth）/ Server Action / 権限 enforcement はこのあと。

### 次にやること（Phase 2 の続き）
1. **[ユーザー操作]** Supabase プロジェクトを作成し、`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` を `.env.local` に設定（`.env.example` 参照）。
2. **[ユーザー操作 または CLI セットアップ]** `supabase` CLI をインストールし、`supabase link` → `supabase db push` で migration を反映。または Supabase ダッシュボードの SQL Editor で直接流す。
3. `docs/open-questions.md` Q1（管理者認証方式）を決定 → ADR-0013 として `docs/decisions.md` に追加。推奨は Supabase Auth。
4. `src/lib/supabase/` に anon（publishable key 用）と admin（secret key 用、server-only）のクライアントを追加。
5. `src/server/auth/` に管理者セッション確認 + `requireFacilityPermission` / `requireSuperAdmin` ユーティリティ。
6. 予約確定・採番・繰り上げを行う RPC（Postgres function）を追加 migration で追加。unit test は SQL レベルで pg container を起動できるなら integration test に寄せる。
7. 予約番号 sequence の原子的 UPDATE を薄くラップしたサーバー側関数 `allocateReservationNumber(code)` を `src/server/reservations/` に追加（RPC 経由で呼ぶだけの薄い層）。
8. 監査ログ書き込みラッパを `src/server/audit/` に。

### ブロッカー / 未確定
- **Supabase プロジェクト未作成**（ユーザー操作が必要）。作成してキーを `.env.local` に入れれば migration 適用と以降の実装に進める。
- **Resend アカウントとドメイン認証**（Phase 3 時）。
- **GitHub リモート未設定**（公開準備ができたら `gh repo create` を依頼予定）。
- `docs/open-questions.md` に 13 件の未確定事項。Q1（認証方式）を次に確定したい。
- Playwright ブラウザと system deps は devcontainer 再作成時に再セットアップ要（`bash .devcontainer/post-create.sh` → `pnpm exec playwright install chromium` → `sudo $(which pnpm) exec playwright install-deps chromium`）。

### 直近コマンド結果
- `pnpm format:check`: `All matched files use Prettier code style!`
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 3 files / **19 tests passed**
- `pnpm build`: Compiled successfully / 4 static pages (Next.js 16.2.4 Turbopack)
- `pnpm test:e2e`: 未実行（今回 UI 無変更のため）

### Git
- ブランチ: `main`（Phase 2 骨格はコミット対象）
- リモート: 未設定
- 前セッション末以降のコミット: `a97574b` chore(supabase): switch env to new publishable/secret key scheme
- 本セッションのコミット予定:
  - Phase 2 初期のスキーマ + ドメインロジック（`supabase/migrations/...` + `src/lib/reservations/*` + `src/server/reservations/*` + docs 更新）
