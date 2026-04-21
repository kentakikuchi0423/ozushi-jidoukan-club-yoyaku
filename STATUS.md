# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 2 終盤 → Phase 3 着手: クラブ一覧ページ）

### 今セッションでやったこと（Phase 2 クロージングから Phase 3 着手まで一気通貫）
- **Phase 2 クロージング**:
  - Next.js middleware（`src/middleware.ts`）で全ルートの Supabase セッション refresh と `/admin/*` のガード（未ログインは `/admin/login?next=...` リダイレクト）
  - `/admin/login` プレースホルダ（Phase 4 でログインフォームに差し替え）
  - 監査ログ書き込みラッパ `src/server/audit/log.ts`（失敗時は `AuditLogWriteError` throw）
  - Retention cleanup SQL 関数 migration（`cleanup_expired_clubs` / `cleanup_old_audit_logs`、SECURITY DEFINER、リモート適用済み）
  - 運用 docs `docs/operations.md`（Supabase セットアップ / `pnpm db:push` / 初期 super_admin bootstrap / retention 手動実行 / secret 再発行）
- **Phase 3 着手**:
  - `list_public_clubs()` RPC を追加（`supabase/migrations/20260422020000_public_club_listing.sql`、リモート適用済み）— 対象クラブ + 施設名 + confirmed/waitlisted 件数を `start_at desc` で返す SECURITY DEFINER 関数
  - `src/lib/clubs/types.ts`: `ClubListing` 型、`deriveClubAvailability`（空きあり / 予約待ち / 終了）、`hasValidPhotoUrl`（http/https のみ許可）
  - `src/lib/clubs/types.test.ts`: 7 ケース
  - `src/lib/clubs/query.ts`: `fetchListableClubs()` — server component から RPC 呼び出し、`FacilityCode` で型絞り
  - `src/lib/format.ts`: JST 固定の `Intl.DateTimeFormat` ベースフォーマッタ（ADR-0010）
  - **`src/app/page.tsx` を全面書き換え**: Home = クラブ一覧。`ClubCard` が日付・時間・館バッジ・ステータス・定員/予約・写真リンク・「予約する」導線を表示。現状クラブ 0 件なので空状態が出る
  - e2e smoke を新レイアウトに合わせ 3 ケースに更新（空状態 or クラブ行のどちらでも通る / admin ログイン導線 / `html[lang=ja]`）
- **ローカルパイプライン all green**:
  - `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test`（6 files / **40 tests passed**）/ `pnpm build`（Home が dynamic、middleware 登録）/ `pnpm test:e2e`（**3 tests passed**）/ `pnpm db:push`（2 件適用）

### 現在地
- **Phase 2 は 95%**、**Phase 3 は 15%**。
- 利用者トップ（クラブ一覧）が実 DB 経由で描画できる状態。クラブが登録されれば即座に出る。
- Supabase プロジェクトはクラブ 0 件なので、見た目は空状態。クラブの投入は Phase 4（管理画面）実装か、Supabase Studio から手動 INSERT のどちらかで再現できる。

### 次にやること
1. **クラブ詳細ページ** `/clubs/[id]`（Server Component）: `list_public_clubs` の 1 件を抽出 or 新 RPC `get_public_club(id)` を追加して、日付・時間・館名・対象年齢・説明・写真・予約フォーム導線を表示。`notFound()` で 404 もハンドル。
2. **予約入力フォーム**: `/clubs/[id]/reserve`（Client Component + Server Action）。`reservationInputSchema` でクライアント側プレビュー検証 + Server Action で再検証 → `createReservation(clubId, input)` を呼ぶ。失敗時は Server Action が `ReservationInputError` / `ReservationConflictError` を catch して form に戻す。
3. **完了画面** `/clubs/[id]/done?r=...&t=...`: reservation_number + 確認 URL を表示。メール送信は Resend 接続後（ユーザー操作必要）。
4. **予約確認・キャンセル画面** `/reservations?r=...&t=...`: URL で受け取ったトークンをサーバー側で検証し、キャンセル Server Action を用意。
5. **Resend 接続はユーザー操作**（アカウント作成 + ドメイン認証 + `RESEND_API_KEY` + `RESEND_FROM`）。メール送信テンプレートとラッパは、先に `.env` 設定なしでもビルドが通るよう書ける（呼び出し側 from を guard）。

### ブロッカー / 次にユーザー操作が必要になる地点
- **Resend アカウント**（予約完了メール / 繰り上げ通知 / キャンセル確認）の実送信テストに必要
- **初期 super_admin の作成**（Phase 4 の管理画面から実物のクラブを登録する時、`docs/operations.md` §3 の手順）
  - もしくは Supabase Studio の SQL Editor で手動 INSERT してクラブを 1 件作れば、クラブ詳細 / 予約フォームの開発確認が進む
- **GitHub リモート**（Phase 6 で `gh repo create` を依頼）
- **Vercel 接続 + Cron 設定**（Phase 6 リリース時）

### 直近コマンド結果
- `pnpm format:check`: All matched files use Prettier code style!
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 6 files / **40 tests passed**
- `pnpm build`: Compiled successfully (Next.js 16.2.4)。Home は dynamic render。
- `pnpm test:e2e`: **3 tests passed**
- `pnpm db:push`: 2 migration 適用（reservation_rpcs / retention_cleanup / public_club_listing が反映済み）

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションの主要コミット:
  - `28b6917` feat(phase-2): middleware, audit wrapper, retention cleanup
  - `bdba4a2` docs(phase-2): operations runbook and bump Phase 2 to 95%
  - 次に: feat(phase-3) opening — public club list page（まだコミット前）
