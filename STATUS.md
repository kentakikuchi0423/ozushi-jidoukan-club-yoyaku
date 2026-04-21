# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 2 クロージング: middleware + 監査ログ + retention + 運用 docs）

### 今セッションでやったこと
- **Next.js middleware を追加**（`src/middleware.ts`）:
  - 全ルートで `@supabase/ssr` の session を refresh（access_token の自動更新）
  - `/admin/*` への未ログインアクセスは `/admin/login?next=...` にリダイレクト。`/admin/login` 配下だけは除外
  - matcher から静的アセットと画像ファイルを除外
  - `/admin/login/page.tsx` にリダイレクト先のプレースホルダを配置（Phase 4 でフォームに置換予定）
- **監査ログ書き込みラッパ**:
  - `src/server/audit/log.ts` — `logAdminAction({ adminId, action, targetType, targetId, metadata })` を admin クライアント経由で INSERT
  - INSERT 失敗は `AuditLogWriteError` を throw（"誰が何をしたか" を残さず管理操作だけ成功する状況を避ける）
- **Retention cleanup SQL 関数を追加 → リモート適用**:
  - `supabase/migrations/20260422010000_retention_cleanup.sql`（`pnpm db:push` で適用済み）
  - `public.cleanup_expired_clubs(p_keep_days default 365)` — `start_at < now() - 365日` のクラブを DELETE（予約は cascade）、`audit_logs` に `retention.cleanup_clubs` を記録。下限 30 日で安全ガード
  - `public.cleanup_old_audit_logs(p_keep_days default 1095)` — 3 年以上前の監査ログを DELETE、自身の実行も `retention.cleanup_audit_logs` として残す。下限 180 日
  - どちらも SECURITY DEFINER + `search_path = public, pg_temp` + `revoke all ... from public`（secret key 経由でのみ呼べる）
- **運用 docs を整備**（`docs/operations.md`）:
  - Supabase プロジェクトセットアップ
  - `pnpm db:push` の流し方
  - **初期 super_admin の bootstrap**（Studio で `auth.users` 作成 → SQL Editor で `admins` + `admin_facilities` に 3 館分 INSERT）
  - Retention cleanup の手動実行 / 自動化（Vercel Cron or pg_cron）
  - DB パスワード / secret key の再発行手順
  - README と `docs/architecture.md` からリンク
- **ローカルパイプライン all green**:
  - `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test`（5 files / **33 tests passed**）/ `pnpm build`（5 ルート、middleware 登録）/ `pnpm test:e2e`（**2 tests passed**）/ `pnpm db:push`（適用）

### 現在地
- **Phase 2 は 95%**。バックエンド側（スキーマ / RLS / 認証 / 権限 / 予約 RPC / 監査 / retention / middleware / bootstrap docs）が揃った。
- 残るは Phase 4 に接続する admin ログインフォーム、Phase 6 の integration test と Vercel Cron の実稼働設定のみ。
- Phase 3（利用者画面）の骨組みに入れる状態。

### 次にやること
1. **Phase 3 着手**: `src/app/page.tsx` を差し替えて、Supabase からクラブ一覧（`clubs_select_public` ポリシー経由、日付降順・時間降順）を取得して表示。
2. クラブ詳細ページ `/clubs/[id]` で予約入力 → 確認 → 完了（メール送信は Resend 登録後）。
3. 予約確認画面 `/reservations?r=...&t=...` から `cancelReservation()` を呼ぶ UI。
4. Phase 3 の UI を shadcn/ui でセットアップし、モバイルレイアウトも確認。
5. キャンセル期限（2 営業日前 17 時）判定ユーティリティを `src/lib/reservations/cancellation-deadline.ts` に追加（ADR-0010、`date-fns-tz` + `@holiday-jp/holiday_jp`）。Phase 5 直前で良い。

### ブロッカー / 次にユーザー操作が必要になる地点
- **Resend アカウントとドメイン認証**（Phase 3 でメール送信を実装する時）
- **初期 super_admin の作成**（Phase 4 の管理画面を触り始める時、`docs/operations.md` §3 の手順でユーザーに実行依頼）
- **GitHub リモート**（Phase 6 で `gh repo create` を依頼）
- **Vercel 接続 + Cron 設定**（Phase 6 リリース時）
- それまでは自走可能

### 直近コマンド結果
- `pnpm format:check`: All matched files use Prettier code style!
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 5 files / **33 tests passed**
- `pnpm build`: Compiled successfully (Next.js 16.2.4) / 3 static routes + middleware registered
- `pnpm test:e2e`: **2 tests passed** (chromium) — middleware 通過下でも OK
- `pnpm db:push`: `Applying migration 20260422010000_retention_cleanup.sql... Finished.`

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションのコミット（予定）:
  - feat(phase-2): middleware + admin login placeholder + audit wrapper + retention SQL
  - docs(phase-2): operations runbook + bump Phase 2 to 95%
