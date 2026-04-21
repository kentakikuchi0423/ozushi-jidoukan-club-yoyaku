# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 3 半分: 詳細 + 予約フォーム + 完了画面）

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

### 追加でやったこと（同セッション・Phase 3 継続）
- **クラブ詳細ページ** `/clubs/[id]`:
  - `get_public_club(p_id uuid)` SECURITY DEFINER RPC を migration で追加、`pnpm db:push` で適用（`list_public_clubs` と同じ列形で単一行）
  - `fetchClubDetail(id)` を `src/lib/clubs/query.ts` に追加（not found は null）
  - Server Component で詳細表示（館バッジ・日時・対象年齢・定員/予約・写真リンク・説明 + `<ReservationForm />`）
  - `availability === "ended"` なら form を出さず「受付終了」文面、`"waitlist"` なら事前に予約待ちである旨を案内
- **予約フォーム + 利用規約確認画面**:
  - `src/app/clubs/[id]/reservation-form.tsx` Client Component、state で `draft ↔ preview` を切替
  - `reservationInputSchema` でクライアント側の軽い検証（UX 用）、Server Action 側でも再検証（security boundary）
  - preview ステップで利用規約 4 項目（先着順 / キャンセル期限 / 無断欠席原則禁止 / キャンセル続くと利用停止あり）を明示
  - 「内容を確認する」→ 「予約を確定する」の 2 アクション、送信中は disabled
- **Server Action** `createReservationAction(clubId, input)`:
  - zod + RPC の二重検証、成功時は `/clubs/[id]/done?r=...&t=...&s=...&p=...` に `redirect()`
  - `ReservationInputError` / `ReservationConflictError` / その他を serialize して返し、form 側がメッセージを表示
- **完了画面** `/clubs/[id]/done`:
  - `searchParams` から `r`, `t`, `s`, `p` を取り、不正なら `notFound()`
  - 予約番号 + 予約確認 URL（`NEXT_PUBLIC_SITE_URL` + `/reservations?r=...&t=...`）を表示し、第三者に共有しないよう警告
  - waitlisted の場合は順位 `p` を表示

### 次にやること
1. **予約確認・キャンセル画面** `/reservations?r=...&t=...`: URL トークンを server 側で検証し、予約の状態（確定/待ち/キャンセル済）を表示。Server Action `cancelReservationAction(r, t)` を用意し、「キャンセルする」ボタンで呼ぶ。キャンセル後は繰り上げ情報を画面に反映。
2. **E2E シナリオ**: 「クラブ一覧 → 詳細 → フォーム入力 → 確認 → 予約確定 → 完了 → 確認 URL → キャンセル → 再度確認」を Playwright で通す。シード用の migration またはテスト前フックでクラブ 1 件を用意する（Phase 6 整備可能だが、最小限 1 本書いてから着手しても良い）。
3. **メール送信基盤**: `src/server/mail/` に Resend ラッパ（`confirmed` / `waitlisted` / `promoted` / `canceled` のテンプレ）。Resend アカウント未作成でも `.env.local` 未設定時はログ出力に fallback するようにしておき、Phase 3 クロージングは Resend 準備後に。

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
