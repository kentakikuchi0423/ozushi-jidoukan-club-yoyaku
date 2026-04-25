# 受入テスト（Acceptance Tests）

本番デプロイ前・重要アップデート後に人の目で追う検証シナリオをまとめる。
各シナリオは《前提 / 手順 / 期待結果 / NG 時の対応》の 4 段構成。
シナリオの **★** は Playwright で自動化済みを示す。手動の印刷・ブラウザ画面での確認を想定している。

- 対象環境: Production（本番）または Staging
- 実行者: 保守担当（Claude / システム管理者）
- 実行頻度: リリース前、主要アップデート後、年 1 回以上

自動テストだけ走らせたい場合:

```bash
pnpm test:e2e                                    # default（smoke + permission）
RUN_ADMIN_FLOW_E2E=1 pnpm test:e2e e2e/admin-flow.spec.ts
RUN_RESERVATION_FLOW_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts
RUN_WAITLIST_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts
RUN_PERMISSION_E2E=1 pnpm test:e2e e2e/permission-guard.spec.ts
```

---

## A. 利用者向けシナリオ（8 本）

### A-1. 通常の予約フロー（★）

**前提**: 公開中のクラブが 1 件以上、定員に余裕がある。利用者はメールを受信できるアドレスを持っている。

**手順**
1. 利用者が `/` にアクセスし、クラブ一覧が表示されることを確認
2. 予約したいクラブの「予約する」を押す
3. 保護者・お子さまの氏名（漢字 + ひらがな）、電話、メール、必要なら備考を入力
4. 「確認へ進む」を押してプレビュー画面を確認し、「予約を確定する」を押す
5. 完了画面（`/clubs/[id]/done`）に予約番号と確認用 URL が表示されることを確認
6. 受信した確認メールに以下が含まれているかを確認
   - 予約番号（例: `ozu_123456`）
   - クラブ名、開催日時
   - 確認用 URL（`/reservations?r=...&t=...`）
   - 全館の連絡先がフッターに列挙されている

**期待結果**: 上記すべて満たす。`audit_logs` は該当無し（利用者予約は audit_logs に残さない）。

**NG 時**: メールが届かないときは Resend のドメイン検証 / 送信先が自分のアドレスかを確認（`docs/operations.md §6`）。

---

### A-2. 予約確認とキャンセル（期限内、★）

**前提**: A-1 で予約済み。開催日まで 2 営業日以上ある。

**手順**
1. 確認メール内の URL を開き、`/reservations?r=...&t=...` が表示されること
2. 予約内容、ステータス（「ご予約は確定しています」）が表示されること
3. 「この予約をキャンセルする」を押す
4. 確認ダイアログで「キャンセルを確定する」を押す
5. キャンセル完了メッセージが表示され、予約ステータスが「キャンセル済み」になること
6. キャンセル通知メールが届くこと

**期待結果**: 定員に空きが戻り、利用者トップから再予約できる。

**NG 時**: `audit_logs` には載らない（これも利用者操作）。失敗時は `/api/...` のレスポンスと Supabase の `reservations.status` を確認。

---

### A-3. 定員満タン → 待ちリスト → 繰り上がり

**前提**: `capacity=1` の公開クラブを管理者が作成しておく。

**手順**
1. 利用者 A が予約 → 確定（`confirmed`）
2. 利用者 B が同じクラブに予約 → キャンセル待ち（`waitlisted`、完了画面に「○ 番目」と表示）
3. 利用者 A がキャンセル
4. 利用者 B に繰り上がりメールが届く（`reservation.promoted`）
5. 利用者 B の確認 URL を開き、ステータスが「ご予約は確定しています」になっていること

**期待結果**: DB 上では B の `status` が `waitlisted` → `confirmed` に遷移し、A は `canceled`。メール送信記録は Resend ダッシュボードで確認。

**NG 時**: `cancel_reservation` RPC のトランザクション境界のバグが疑われる。該当クラブ ID の `audit_logs` と `reservations` を照合。

---

### A-4. 受付期限後のアクセス

**前提**: 開催日時が過去のクラブが残っている（retention cleanup 前の 1 年間）。

**手順**
1. `/` で該当クラブが「終了」バッジ付きで表示されること
2. 詳細ページを開くと「このクラブは受付を終了しました。」が出る
3. 「予約する」ボタンは表示されない（`受付終了` のラベルのみ）

**期待結果**: 同上。予約フォームは表示されない。

**NG 時**: `deriveClubAvailability` の境界値バグが疑われる。`formatJstDate/Time` の TZ 周りを確認。

---

### A-5. 他人の予約番号を使ったアクセス

**前提**: 予約 A が存在し、その `reservation_number` だけ第三者が知り得た想定。

**手順**
1. `/reservations?r=<予約番号>&t=<無効な token>` を開く
2. 404（または「予約が見つかりません」）になること

**期待結果**: 他人の予約内容が表示されない。`secure_token` と一致する組み合わせでのみ 200 を返す。

**NG 時**: RLS / RPC の実装が緩んでいる。`get_my_reservation` RPC の SECURITY DEFINER 関数を再確認。

---

### A-6. キャンセル期限超過時

**前提**: 開催日まで 2 営業日を切ったクラブの予約が残っている。

**手順**
1. 確認 URL を開き、予約内容が表示されること
2. 「予約のキャンセル」節で、キャンセルボタンが出ず「キャンセル期限（開催日の 2 営業日前 17 時）を過ぎているため、このページからはキャンセルできません。」のメッセージが出ること

**期待結果**: UI でブロックされる。Server Action 側でも `cancelReservationAction` が `deadline-past` を返す（二重防御）。

**NG 時**: `cancellationBlockedReason` の営業日計算 + `@holiday-jp/holiday_jp` の祝日判定を確認。

---

### A-7. 未公開クラブの非表示

**前提**: 管理者が `published_at = null`（未公開）のクラブを 1 件作成。

**手順**
1. 利用者が `/` にアクセス → 該当クラブは一覧に出ない
2. 該当クラブの URL `/clubs/<id>` を直接打つ → 404

**期待結果**: 公開ボタンを押すまで利用者には見えない。

**NG 時**: `list_public_clubs` / `get_public_club` RPC の `published_at IS NOT NULL` フィルタ漏れ疑い。

---

### A-8. 写真リンクの表示切替

**前提**: 同じクラブ 2 件を用意。片方は `photo_url` あり（有効な http(s)）、もう片方は空。

**手順**
1. 一覧と詳細で、`photo_url` ありは「写真を見る」、無しは「準備中」の表記になっていること
2. 「写真を見る」を押すと新しいタブで開く（`target="_blank" rel="noopener noreferrer"`）

**期待結果**: 同上。`javascript:` 等の URL は zod で弾かれ投入不可。

---

## B. 管理者向けシナリオ（10 本）

### B-1. 管理者ログインとログアウト（★）

**前提**: 事前に super_admin アカウント発行済み（`docs/operations.md §3`）。

**手順**
1. `/admin/login` を開き、メール + パスワードでログイン
2. `/admin/clubs` に到達
3. 画面上部に「○○ さん、お疲れさまです」と表示されること
4. 「ログアウト」ボタンで `/admin/login` に戻ること

**期待結果**: ログイン成功で `audit_logs` に `admin.login.succeeded` が追加される（`docs/operations.md §10-1` で確認可能）。

**NG 時**: 失敗時は `admin.login.failed` に reason が残る。ブラウザの DevTools Cookie で `sb-*` が更新されているか確認。

---

### B-2. クラブ新規登録（★）

**前提**: クラブ・事業マスターが 1 件以上登録済み。担当館が割り当てられている。

**手順**
1. `/admin/clubs` → 右上「クラブを新規登録」
2. 館、クラブ・事業、開催日、開始・終了時刻、定員、写真 URL、補足を入力
3. 「登録する」を押す
4. 一覧で未公開バッジ付きで表示されること
5. 「公開する」ボタン → 確認ダイアログ → 押下で「公開済み」に切り替わる

**期待結果**: `audit_logs` に `club.create` と `club.publish` が記録される。

---

### B-3. クラブ編集（★）

**前提**: B-2 で作ったクラブがある。

**手順**
1. 該当クラブの「編集」を押す
2. 定員を 5 → 8 に変更し、「変更を保存する」
3. 一覧で「定員 8名」に反映されていること

**期待結果**: `audit_logs` に `club.update`（`capacity` 変化は metadata には含めないが updated_at だけで追跡可能）。

---

### B-4. クラブ削除（★）

**前提**: 上記クラブがある。

**手順**
1. 編集画面に入り「このクラブを削除する」
2. 確認ダイアログで OK を押す
3. 一覧から消え、利用者画面からも見えなくなること
4. ただし既に予約がある場合、予約者の確認 URL は引き続き開ける

**期待結果**: soft delete（`clubs.deleted_at` セット）。`audit_logs` に `club.delete`。

---

### B-5. 別館 admin による他館クラブ編集の拒否

**前提**: 館 A にのみ権限を持つ admin B を用意（`ADMIN_SINGLE_FACILITY_EMAIL` 環境）。

**手順**
1. admin B でログイン
2. 館 A とは別の館 C のクラブ URL を直打ち（例: `/admin/clubs/<他館 club id>/edit`）
3. 404（notFound）になること

**期待結果**: 許可館以外のクラブは `fetchClubForAdmin` で null を返し、`notFound()`。

**NG 時**: 404 でなく 500 / 200 が出る場合は `requireFacilityPermissionOrThrow` もしくは `fetchClubForAdmin` の条件を要確認。

---

### B-6. 館マスター CRUD（super_admin のみ、★）

**前提**: super_admin でログイン。

**手順**
1. `/admin/facilities` → 「新規登録」
2. prefix（例: `test`）、館名、電話を入力 → 登録
3. 一覧に新館が追加される
4. 「編集」で館名を変更 → 保存
5. 「削除」で soft delete（既存クラブ・予約・admin_facilities は残る旨のメッセージ）

**期待結果**: `audit_logs` に `facility.create` / `facility.update` / `facility.delete`。既存の super_admin が新館に対する権限を自動的に持つ（`admin_facilities` 行が追加される）。

---

### B-7. 削除済み館の参照整合性

**前提**: 既に予約があるクラブが紐づく館を削除した（ソフト削除）。

**手順**
1. 利用者が該当予約の確認 URL を開く
2. 館名が正しく表示されること（「削除済み」などで壊れない）
3. `/admin/clubs/[id]/reservations` で予約者一覧を開き、館名が表示されること

**期待結果**: `get_my_reservation` 等の SECURITY DEFINER RPC は JOIN 経由で削除済み館名も取得できる（`facilities_select_public` は公開画面用で、RPC には影響しない）。

---

### B-8. アカウント追加とログイン

**前提**: super_admin でログイン。

**手順**
1. `/admin/accounts` → 招待フォームで email / 初期パスワード / 担当館を指定
2. 「招待を送信する」を押し、「招待メールを送信しました」のメッセージ
3. 招待先の Gmail 等で、日本語の招待メールを受信
4. メール内のリンクを開き、`/auth/callback?code=...` → `/admin/clubs` に着地
5. ログアウト → 再度ログインフォームで同じ email + 指定パスワードでログイン可能

**期待結果**: `audit_logs` に `admin.create`。新 admin がログインすると `admin.login.succeeded`。

---

### B-9. パスワード変更

**前提**: 任意の admin でログイン。

**手順**
1. `/admin/password` を開く
2. 現在のパスワード、新しいパスワード、確認用を入力
3. 保存 → 「パスワードを更新しました。」が表示される
4. ログアウト → 新パスワードでログイン可能

**期待結果**: `audit_logs` に `admin.password.change`。

**NG 時**: 新パスが複雑性要件（8 文字以上、英字 + 数字を含む）を満たしていない場合は失敗し、UX 文言が出る。

---

### B-10. 非 super_admin の super-only 画面アクセス（★）

**前提**: 1 館のみ権限を持つ admin でログイン。

**手順**
1. 上部ナビの「館の管理」「アカウント追加・削除」が表示されていること
2. 「館の管理」をクリック → `/admin/facilities` に遷移するが amber 警告「このページは全館管理者のみ利用できます。」が表示され、CRUD ボタンは出ない
3. 「アカウント追加・削除」も同様

**期待結果**: 表面上は見えるがサーバーサイドで弾かれる。`requireSuperAdmin()` の挙動を示す。

---

## E2E 自動化の対応マッピング

| シナリオ | spec | 状態 |
| --- | --- | --- |
| A-1, A-2（予約 → キャンセル） | `e2e/reservation-flow.spec.ts` | `RUN_RESERVATION_FLOW_E2E=1` |
| A-3（待ちリスト → 繰り上げ） | `e2e/reservation-flow.spec.ts` | `RUN_WAITLIST_E2E=1`（今回追加、下記参照） |
| A-4, A-7, A-8 | — | 手動 |
| A-5 | `e2e/permission-guard.spec.ts` の将来拡張案 | 手動（現状） |
| A-6 | — | 手動 |
| B-1〜B-4 | `e2e/admin-flow.spec.ts` の club CRUD | `RUN_ADMIN_FLOW_E2E=1` |
| B-5 | `e2e/permission-guard.spec.ts` 将来案 | 手動 |
| B-6 | `e2e/admin-flow.spec.ts` の facility CRUD | `RUN_ADMIN_FLOW_E2E=1` |
| B-7 | — | 手動 |
| B-8 | — | 手動（実メール送信を伴うため） |
| B-9 | — | 手動 |
| B-10 | `e2e/permission-guard.spec.ts` | `RUN_PERMISSION_E2E=1` + 2 人目 admin |

---

## 補足

- スクリーンショット付きの利用者・管理者マニュアルは `docs/user-manual.md` / `docs/admin-manual.md`。
- 監査ログの確認手順は `docs/operations.md §10` に SQL 付きでまとめている。
- 運用開始後は、月次でログイン監査ログを tail し、同一 email への連続失敗が無いかを確認する。
