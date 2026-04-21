# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 2 仕上げ前段・予約 RPC + 入力バリデーション）

### 今セッションでやったこと
- **zod を導入して予約フォーム入力 schema を実装**:
  - `src/lib/reservations/input-schema.ts` — parentName / parentKana / childName / childKana / phone / email / notes の zod スキーマ
  - ひらがな（U+3040–309F、長音、全角／半角空白）のみ許容、phone は `[0-9+\-() ]{7,20}`、email は `z.email()`、notes は 500 文字上限で空文字は `undefined` に正規化
  - `input-schema.test.ts` で 9 ケース（成功 / カタカナ拒否 / 漢字拒否 / 空白拒否 / 電話形式 / メール形式 / 500 字上限 / notes オプショナル）
- **予約ステータスの共有型**:
  - `src/lib/reservations/status.ts` — `ReservationStatus` = `'confirmed' | 'waitlisted' | 'canceled'` と `isReservationStatus`
- **予約確定・キャンセル RPC を migration として追加 → リモート DB に適用**:
  - `supabase/migrations/20260422000000_reservation_rpcs.sql`
  - `reservation_number_sequences` の CHECK を `100000..1000000` に緩め、上限 `_999999` まで確実に採番できるようにした
  - `create_reservation(club_id, secure_token, form...)` SECURITY DEFINER:
    - 同一クラブの並列予約を `clubs FOR UPDATE` でシリアライズ
    - `reservation_number_sequences` を `UPDATE ... RETURNING next_value - 1` でアトミックに採番
    - 確定済み件数で `confirmed` / `waitlisted` を決定（ADR-0005）
    - クラブ開始済みなら 22023 エラー
    - GRANT EXECUTE to anon/authenticated
  - `cancel_reservation(reservation_number, secure_token)` SECURITY DEFINER:
    - トークン一致を必須とする（ADR-0006）
    - 既に canceled の場合は idempotent に no-op
    - 元が confirmed のときは `clubs FOR UPDATE` を取ってから waitlist 先頭を `confirmed` に繰り上げ、繰り上げ対象の `reservation_number` / `email` を返す
    - GRANT EXECUTE to anon/authenticated
  - `pnpm db:push` で適用済み
- **Node 側ラッパ**:
  - `src/server/reservations/create.ts` — zod で入力検証 → `generateSecureToken()` → `supabase.rpc('create_reservation', ...)`。失敗は `ReservationInputError`（issue 情報付き）/ `ReservationConflictError`
  - `src/server/reservations/cancel.ts` — 予約番号・トークンの形式を検証してから `supabase.rpc('cancel_reservation', ...)`。`P0002` を `ReservationNotFoundError` に正規化
- **ローカルパイプライン all green**:
  - `pnpm format:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test`（5 files / **33 tests passed**）/ `pnpm build` / `pnpm db:push`（適用）すべて exit 0

### 現在地
- **Phase 2 は 85%**。予約の核心ロジック（アトミック採番・キャパシティ判定・繰り上げ）まで完成。
- 残るは：admin middleware（セッション refresh と `/admin/*` のガード）、audit_logs 書き込みラッパ、retention cleanup、bootstrap 手順のドキュメント化、RPC の integration test。
- Phase 3（利用者画面）の骨組みに入れる状態。

### 次にやること
1. `src/middleware.ts` を追加して `/admin/*` の前で Supabase セッションを refresh し、未ログインは `/admin/login` にリダイレクト。Auth コールバックハンドラ `/auth/callback` も用意。
2. `src/server/audit/` に `logAdminAction(action, targetType, targetId?, metadata?)` を admin client で INSERT。Phase 4 で各管理操作から呼ぶ。
3. retention cleanup（1 年以上前のクラブ削除）を migration + Vercel Cron の設計。最短は pg_cron で日次 DELETE。
4. `docs/architecture.md` or 新 doc に初期 super_admin の bootstrap 手順を書く（Supabase Studio で `auth.users` 作成 → `admins` / `admin_facilities` 挿入）。
5. Phase 3 着手: `src/app/(user)/page.tsx` にクラブ一覧を `@/lib/supabase/server` 経由で表示。`clubs_select_public` ポリシーで anon でも読める。

### ブロッカー / 未確定
- **Resend アカウントとドメイン認証**（Phase 3 時にユーザー操作）
- **GitHub リモート未設定**（Phase 6 前に `gh repo create` を依頼予定）
- 予約 RPC の integration test は pg テストコンテナ or staging Supabase で Phase 6 に実施

### 直近コマンド結果
- `pnpm format:check`: All matched files use Prettier code style!
- `pnpm lint`: 0 warnings / 0 errors
- `pnpm typecheck`: 0 errors
- `pnpm test`: 5 files / **33 tests passed**
- `pnpm build`: Compiled successfully (Next.js 16.2.4)
- `pnpm db:push`: `Applying migration 20260422000000_reservation_rpcs.sql... Finished.`

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションのコミット（予定）:
  - feat(phase-2): reservation create/cancel RPCs with zod input schema
  - docs(phase-2): bump Phase 2 to 85%
