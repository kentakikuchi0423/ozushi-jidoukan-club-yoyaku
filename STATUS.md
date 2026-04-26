# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-26（管理者キャンセル導線 + Q14 上限到達時方針）

### このチャンクで解消したもの
1. **管理者キャンセル導線**（ADR-0021）:
   - migration `20260425000000_admin_cancel_reservation.sql`：`admin_cancel_reservation(p_reservation_id uuid)` RPC を追加（SECURITY DEFINER、`grant execute` は service_role のみ）
   - `src/server/reservations/admin-cancel.ts`：admin client 経由の RPC 呼び出しラッパ
   - `src/server/reservations/admin-detail.ts`：予約 1 件 + クラブ + 館 + プログラム + 保護者 / 子どもを 1 クエリで取得
   - `src/app/admin/reservations/[id]/cancel/page.tsx`：確認画面。予約内容と「キャンセル通知メール送信」「waitlist 繰り上げ」「取り消し不可」を明示
   - `src/app/admin/reservations/[id]/cancel/actions.ts`：Server Action。再度の権限チェック → RPC → メール送信（既存の `notifyReservationCanceled` / `notifyReservationPromoted` を再利用） → 監査ログ → redirect
   - 予約者一覧（`/admin/clubs/[id]/reservations`）の active な予約に「キャンセルする」リンクを追加。成功時は `?canceled=1` で success FormMessage 表示
   - 締切（2 営業日前 17 時）チェックは admin 経路では行わない（強制キャンセル想定）
2. **予約番号 6 桁上限到達時の方針**（Q14）:
   - `docs/open-questions.md` に Q14 を新設。CLAUDE.md 固定要件「番号再利用しない」を維持
   - 平時は何もしない（実質 246 年到達不可）。到達時の対応手順（migration SQL ひな形 + アプリ側 3 ファイル改修 + 注意点）を明記
3. **本番 Supabase に migration 適用 + ローカル E2E で疎通確認**:
   - `pnpm db:push` で `20260425000000_admin_cancel_reservation.sql` を本番に適用
   - `pnpm build` + `PORT=3101 pnpm start`（ローカル）+ Playwright 一発スクリプト（`/tmp/admin-cancel-e2e.mjs`）で「予約作成 → ログイン → 一覧 → キャンセル → ?canceled=1 + キャンセル済みバッジ」まで通った
   - 当初の本番エラー（「予約のキャンセルに失敗しました」）は **migration が本番未適用 + Vercel に旧コード**の合わせ技。ローカル `pnpm dev` から本番 Supabase を叩いた時に PGRST202 で落ちていた
   - 副次対策: `admin-cancel.ts` で PostgREST の code/hint/details を `console.error` に出すよう強化（次回の同種トラブル時に Vercel ログから即特定できるように）
4. **docs**:
   - `docs/decisions.md` に **ADR-0021** 追加
   - `docs/open-questions.md` の **Q5** を Resolved（管理者キャンセル実装済み）+ **Q14** を新設
   - `docs/architecture.md`: ディレクトリ構成 / RPC 表 / 4.2 / 4.3 / 5.3 監査ログ一覧 / migration 数（14 → 15）を更新
   - `docs/requirements.md`: §4.5 として管理者キャンセル要件を追加
   - `docs/security-review.md`: §1 に「管理者による予約キャンセル」行を追加 + §8 にレビュー実施記録 1 行
   - `docs/admin-manual.md`: §6-2「管理者によるキャンセル」+ §9 監査ログに `reservation.admin_cancel` を追加
   - `docs/operations.md`: §10-5 として `reservation.admin_cancel` の tail SQL + §11 のリリース前手動チェックに項目追加
   - `docs/acceptance-tests.md`: B-10「管理者による予約キャンセル」を新設、既存 B-10 を B-11 に振り替え + マッピング表更新
   - `docs/testing-strategy.md`: §3 観点に管理者キャンセルを追加
   - `docs/manual-index.md` / `README.md`: ディレクトリ構成・索引を最新化

### ⚠ 次の一手
- `git push origin main`（ローカルは origin/main から **9 コミット先行**。Vercel 自動デプロイ）
- デプロイ後、本番で B-10 の手動シナリオを 1 周し、`audit_logs` に `reservation.admin_cancel` が残ることを確認
- 本番 DB に残っているテスト予約（`ozu_100010` / `ozu_100011`：キャンセル待ち、`ozu_100012`：キャンセル済み、いずれも email = `playwright-test@example.invalid`）は管理画面から `ozu_100010` / `ozu_100011` を順次キャンセルして整理。retention cleanup（1 年）でも自動消去される

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck` / `pnpm build`: all green
- `pnpm test`: 25 passed（Vitest worker teardown の flake は既知のもので、テスト自体は全 PASS）
- 管理者キャンセル E2E（ローカルビルド + 本番 Supabase）: PASS（reservation_id `ozu_100012` で「予約をキャンセルしました」success バナーと「キャンセル済み」バッジまで確認）

---

## 1 つ前: 2026-04-25（本番デプロイ + 表記整理 + ドキュメント整合性監査）

### このチャンクで解消したもの
1. **本番デプロイ完了**:
   - GitHub remote (`kentakikuchi0423/ozushi-jidoukan-club-yoyaku`) 接続、main へ push
   - Supabase 本番プロジェクト（`znclweldcukgaqzrrkcz`、東京リージョン）作成、14 本の migration 適用、初期 super_admin（display_name = 「システム管理者」）を bootstrap
   - Vercel 連携、環境変数投入、`https://ozushi-jidoukan-club-yoyaku.vercel.app/` で稼働
   - Supabase Auth の Site URL を本番固定、Redirect URLs に本番 + localhost 両方登録
   - secret key と DB password を bootstrap 直後にローテーション完了
2. **UI / UX の細かな調整** (`d9837c5` / `2e2327a` / `cf7c677` / `96798b0` / `af74f46`):
   - プライマリボタン（予約する / クラブを新規登録）が WCAG AA を満たすよう primary を `#4f7668` に深色化、要素リセットを `@layer base` に収めて `text-white` を有効化（ADR-0017）
   - クラブ一覧の説明を簡略化、予約フォームの「ご予約にあたってのお願い」改行整理
   - 予約完了画面の「予約内容の確認・キャンセル用 URL」を `<a>` タグに変更（クリック可能に）
   - 予約確認画面の `ClubSection` に対象年齢・概要・補足を追加
   - キャンセル期限の UI 表示を「動的計算した日時」から「開催日の 2 営業日前 17 時」固定文言に変更（active form と past-deadline 分岐の両方）
   - クラブ一覧フィルタに **複数日選択カレンダー**（`DateMultiPicker`）を追加。URL `?dates=YYYY-MM-DD,...`、JST 比較、外部依存なし
3. **メールテンプレ大改修** (`cf7c677`):
   - 利用者向けメール（confirmed / waitlisted / promoted / canceled）から「○○ 様」挨拶を撤去、`parentName` 撤去
   - 「このメールは予約システムから自動送信しています。」をメール先頭に移動、フッタから削除
   - HTML 版を構造化レンダラ（`EmailContent` / `Block`）で再設計、Outlook 互換のインラインスタイル + `<table>` レイアウト + 緑の CTA ボタン（ADR-0016）
4. **ドキュメント整合性監査** (このチャンク):
   - `docs/city-consultation.md` 新設（市担当者協議資料 197 行 + DNS 仕組み解説）
   - 全 docs（README / requirements / architecture / decisions / open-questions / testing-strategy / security-review / operations / acceptance-tests / user-manual / admin-manual）を実装と突き合わせて整合性修正
   - `decisions.md` に新 ADR 追加: 0016 メール multipart / 0017 @layer base / 0018 館マスター動的化 / 0019 club_programs / 0020 published_at
   - `requirements.md` の保護者必須 → 任意、メール本文構成、施設コードの動的管理を反映
   - `architecture.md` の DDL を `facilities.phone` / `deleted_at` / `code` 制約緩和で更新、admin 系メニュー追加、監査ログアクション拡充、メール multipart 化を反映
   - `open-questions.md` の Q3（営業日定義）/ Q10（メール HTML）を Resolved に
   - `user-manual.md` に日付フィルタ説明を追記、キャンセル期限の説明を「祝日・休日が考慮されています」から実態に即した文言に修正
   - `acceptance-tests.md` A-6 の期待文言を新固定文言に更新
   - `testing-strategy.md` のテストファイル名（`reservation-flow.spec.ts` 等）を実態に揃え、CI セクションを「未導入」に整理

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm exec vitest run --pool=forks src/components/clubs/filter-utils.test.ts`: 11 passed
- `pnpm exec vitest run src/server/mail/templates`: 12 passed
- 本番疎通: `/`、`/admin/login`、`/admin/clubs`、予約 → メール受信まで動作確認済

### 次の一手
- 試験導入対象が外部の保護者を含むため、**Resend ドメイン検証** が必要。市担当者と `docs/city-consultation.md` をもとに協議してドメイン方針（市既存サブドメイン / 市新規取得 / 事業者経由 / 暫定 Allowed Recipients）を決定する
- 試験対象が 5 人以下なら Resend Allowed Recipients で当面しのげる
- 本格運用前にテストデータ（テスト事業 / 予約テスト）を削除
- `CRON_SECRET` を任意で設定し、retention cleanup を有効化

---

## 1 つ前: 2026-04-24（本番デプロイ前整備一式: セキュリティ / 保守性 / デザイン / 受入テスト / マニュアル / README）

### このチャンクで解消したもの
1. **Sub-phase A — 館の管理機能コミット** (`9eca98b`)
2. **Sub-phase B — セキュリティ最終仕上げ** (`75722ca`):
   - `loginAction` に `admin.login.succeeded` / `admin.login.failed` 監査ログを追加（email / IP / reason）
   - `e2e/permission-guard.spec.ts` に非 super_admin の amber 警告 E2E（`RUN_PERMISSION_E2E=1`）
   - `docs/security-review.md` の棚卸し（`pnpm audit` で moderate 1 件だが実行経路への影響なし）
   - `docs/operations.md §10` に監査ログの tail 手順（SQL 4 本）を追記
3. **Sub-phase C — UI プリミティブ共通化 + 純粋関数抽出** (`6612aaf`):
   - `src/components/ui/` に Button / Field / Input / Textarea / Select / Badge / Card / FormMessage を新設（CSS 変数ベース）
   - facility-form / program-form / invite-form / delete-*-button / login-form / password-form をプリミティブ化
   - `fetchActiveFacilityContacts` を `src/server/facilities/list.ts` に追加、mail/notify.ts から重複を解消
   - `createFacilityAction` の super_admin 判定を `src/server/auth/super-admin.ts` の純粋関数 `findSuperAdminIdsToGrant`（5 テストケース）に抽出
4. **Sub-phase D — 和みパステル配色への刷新** (`02dc67d`):
   - `globals.css` に theme tokens（生成り背景・若草 primary・桜 accent・空色 info・山吹 warning・若葉 success・淡紅 danger）
   - 主要ページ（/, /clubs/[id], /clubs/[id]/done, /reservations, /admin/* 群）を新トークンに移行、角丸 rounded-xl / rounded-2xl、見出し font-semibold、focus-visible ring
5. **Sub-phase E — 受入テスト** (`ebe2a45`):
   - `docs/acceptance-tests.md` を新設、利用者 8 本 + 管理者 10 本を《前提 / 手順 / 期待結果 / NG 時》で整理
   - `e2e/reservation-flow.spec.ts` に「待ちリスト → 繰り上がり」シナリオ追加（`RUN_WAITLIST_E2E=1` + `E2E_WAITLIST_CLUB_ID`）
   - `docs/operations.md §11` にリリース前チェック手順を追記
6. **Sub-phase F — マニュアル** (`c0bb1ba`):
   - `docs/user-manual.md`（8 節の保護者向けガイド + FAQ + 個人情報注記）
   - `docs/admin-manual.md`（11 節の職員向けガイド、super_admin 限定機能も詳述）
   - `docs/manual-index.md`（入口）+ `docs/images/{user,admin}/` 空ディレクトリ
7. **Sub-phase G — README 刷新**（このチャンク）:
   - 冒頭に「3 分で把握する全体像」「本番を立てるのに必要な外部サービス」「本番セットアップの 6 ステップ」
   - FAQ（`pnpm db:push` SASL / Resend 届かない / Vercel Cron 401 / `/admin/login` できない / Vitest worker flake）
   - `.env.example` を整理（`ADMIN_BOOTSTRAP_*` は E2E 用途であることを明記、`ADMIN_SINGLE_FACILITY_*` / `E2E_WAITLIST_CLUB_ID` を追加）
   - MIT `LICENSE` を追加

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 93+ cases 通過（vitest worker flake は引き続き、個別 run で全通過を再確認）
- `pnpm build`: 20 routes + proxy
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_ADMIN_FLOW_E2E=1`: 2 passed（club + 館 CRUD、serial）
- `RUN_RESERVATION_FLOW_E2E=1`: 1 passed
- `pnpm audit`: moderate 1 件（resend > svix > uuid@10、実行経路への影響なし）

### 次の一手
- GitHub に push → Vercel 接続 → 環境変数投入 → `pnpm db:push`（本番） → 初期 super_admin 作成 → `docs/acceptance-tests.md` の 18 本を手動で確認
- 運用開始後 3 ヶ月で、Sentry / レート制限 / Dependabot の必要性を再評価（`docs/open-questions.md` に記録予定）

---

## 1 つ前: 2026-04-24（館の管理を追加 + 館マスターを動的化）

### このチャンクで解消したもの
1. **管理画面に「館の管理」を追加 + 館マスターの動的 CRUD**:
   - `facilities` テーブルに `phone TEXT NOT NULL` と `deleted_at TIMESTAMPTZ` を追加（既存 3 館は SQL migration で backfill: 0893-24-2285 / 0893-24-2722 / 0893-25-4735）
   - `code` の CHECK を `^[a-z][a-z0-9]{1,9}$` に緩和し、IDENTITY（`facilities_id_seq`、start with 4）で新規行を挿入可能に
   - `reservations.reservation_number` の CHECK も `^[a-z][a-z0-9]+_[0-9]{6}$` に緩和、facility INSERT 時に `reservation_number_sequences` へ自動 seed するトリガーを追加
   - `/admin/facilities` 画面を 3 ルート新設（`page.tsx` / `new/page.tsx` / `[id]/edit/page.tsx`）+ `FacilityForm` / `DeleteFacilityButton` / `actions.ts`
   - `prefix`（予約番号の識別子）は作成時のみ入力、編集では grayed out + 「予約番号との整合のため変更できません」注釈
   - 削除は soft delete（既存クラブ・予約・admin_facilities 行は温存）
   - `createFacilityAction` は新館挿入直後に「作成前の有効館をすべて持つ既存 super_admin」に新館の `admin_facilities` 行を自動挿入して super 権限を維持
   - 監査ログは `facility.create` / `facility.update` / `facility.delete`
2. **館マスターを「DB 引きのみ」に統一**:
   - `src/lib/facility.ts` から `FACILITY_CODES` / `FACILITY_NAMES` / `FACILITY_ID_BY_CODE` / `FACILITY_CODE_BY_ID` / `isFacilityCode` / `facilityName` を削除し、`FacilityCode = string` + `FACILITY_CODE_REGEX` + `isFacilityCodeFormat` のみに
   - `src/server/facilities/list.ts` に `fetchFacilities({includeDeleted})` / `fetchFacilityByCode` / `fetchFacilityById` / `countActiveFacilities` を新設（admin client、RLS バイパス）
   - `computeIsSuperAdmin(facilities)` を async 化（DB から非削除館数を取り比較）、純粋関数 `computeIsSuperAdminFromCount` を分離してテスタブル化
   - 画面・action 側は `FACILITY_NAMES[code]` → DB / 親 prop 経由の参照へ差し替え（`/admin/clubs/*`, `/admin/accounts/*`, `/admin/clubs/[id]/reservations`, `/`, `ClubFilterBar`, `ClubForm`, `InviteAdminForm`）
3. **メールフッターを「全館の連絡先を列挙」する関数に**:
   - `FOOTER` 定数を `renderFooter(facilities)` に変換、5 つのメールテンプレート（confirmed / waitlisted / promoted / canceled / admin-invite）を第 2 引数で `FacilityContact[]` を受け取るシグネチャに変更
   - `notify.ts` は `fetchFacilities({includeDeleted:false})` の結果を各テンプレートに渡す
4. **ナビゲーション**: `/admin/clubs` 上部の「館の管理」「アカウント追加・削除」を全 admin に常時表示、アクセス制御は各ページ側で `requireSuperAdmin()` → amber 警告

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 12 files / 96 cases pass（vitest worker flake は引き続き `thread worker timeout` で数件発生するが、単独実行で全 green を再確認）
- `pnpm build`: 20 routes + proxy（/admin/facilities 3 ルート追加）
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_ADMIN_FLOW_E2E=1`: 2 passed（club CRUD + 館 CRUD、`describe.configure({mode:"serial"})` で直列化）
- `RUN_RESERVATION_FLOW_E2E=1`: 1 passed
- `pnpm db:push`: `20260424000003_facility_phone_and_dynamic.sql` 適用済み

---

## 1 つ前: 2026-04-24（公開ボタン導入 + 日時入力を 3 フィールドに分割）

### このチャンクで解消したもの
1. **クラブを「公開ボタン」で公開するようにした**:
   - `clubs.published_at TIMESTAMPTZ` を追加（NULL = 下書き、値あり = 公開中）
   - RLS `clubs_select_public` と `list_public_clubs` / `get_public_club` RPC を `published_at IS NOT NULL` でフィルタ
   - 新規作成時は `published_at = null`。既存クラブは migration で `created_at` バックフィル
   - `/admin/clubs` のカード「編集」の右側に**緑の「公開する」ボタン**を追加
   - 押下 → 確認ダイアログ → 公開 → グレーアウトの「公開済み」ラベルに切り替わる（トグルは作らない、取り消しは「編集 → 削除」運用）
   - 未公開クラブは admin 画面で「未公開」バッジが付く
   - 公開 action は idempotent、監査ログ `club.publish` を記録
   - 新設 `fetchAdminListableClubs()`（admin client で RLS バイパス）で未公開も一覧表示
2. **クラブ作成フォームの日時を 3 フィールドに分割**:
   - 開催日（`<input type="date">` × 1）+ 開始時刻（`<input type="time">`）+ 終了時刻（`<input type="time">`）
   - 送信直前に `${date}T${start}` / `${date}T${end}` へ合成して既存の `clubInputSchema` に渡す（server 側は無変更）
   - 終了 > 開始をクライアント側でも検証、server エラー (`startAt/endAt`) は `startTime/endTime` に再マッピング
3. **ドキュメント整備**:
   - `docs/architecture.md` の clubs DDL に `published_at` を追記
   - `docs/operations.md` のテストクラブ投入 SQL を `published_at: now()` 付きに変更、クリーンアップ SQL も program_id 経由に

---

## 2 つ前: 2026-04-24（クラブ・事業マスター化 + 仮想スクロール 他）

### このチャンクで解消したもの
1. **クラブ・事業マスターの新設**:
   - `club_programs` テーブル（`name` unique / `target_age` text / `summary` text / soft-delete 用 `deleted_at`）
   - `clubs.name` / `target_age_min` / `target_age_max` を削除し、`program_id` で JOIN
   - 公開 RPC（`list_public_clubs` / `get_public_club` / `get_my_reservation`）を DROP+CREATE で再構築
   - 既存クラブから自動生成した program で移行、既存データは保持
   - 初期マスター「にこにこクラブ（０・１歳児の親子）」を seed
2. **管理画面 `/admin/programs`**:
   - 一覧・新規登録・編集・ソフト削除（参照中でも削除 OK、表示は JOIN で残る）
   - 上部サブナビに「クラブ・事業の編集」リンクを追加
3. **クラブ作成フォームの変更**:
   - 旧: 名前 / 対象年齢 min/max を直接入力
   - 新: ドロップダウンから program を選ぶだけ（名前・対象年齢・概要は自動反映）
   - `説明` は per-club の自由記入として継続
   - 削除済み program を参照している編集画面は「削除済み」警告
4. **クラブ一覧を仮想スクロール化**:
   - `@tanstack/react-virtual` 追加、`VirtualClubList` で公開・管理の双方に適用
   - 件数が少なければ通常レンダリング、多くなっても描画コスト線形化
5. **予約フォームで お子さま優先 + 保護者任意**:
   - セクション順を「お子さま → 保護者」に反転
   - 保護者は空配列スタート、`＋ 保護者を追加` で任意追加、必須アスタリスクなし
   - 空行は validate 前に drop、`parents.max(10).default([])` に zod 変更
   - Migration `20260423020000_optional_parents.sql` で RPC 側も空配列を許可
6. **公開ヘッダーの左揃え統一**:
   - `/` と `/admin/login` のヘッダから `text-center` を外し、全画面の説明文を左揃えに

### 追加ドキュメント整備
- `docs/architecture.md`: clubs テーブル DDL を新スキーマに更新、club_programs を追記
- `docs/operations.md`: テストクラブ投入 SQL を `club_programs` INSERT + `clubs` の program_id 参照に書き換え
- `docs/security-review.md`: `clubInputSchema` の検証項目を `programId` UUID チェックに置換
- `docs/open-questions.md`: Q6 対象年齢形式を「文字列」として Resolved 扱いに

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 12 files / 89 cases pass（vitest worker flake 2 件は既知）
- `pnpm build`: 15 routes + proxy
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_ADMIN_FLOW_E2E=1`: program 作成 → クラブ作成 → 編集 → 削除 → program soft delete の一連を 13.5s で green
- `RUN_RESERVATION_FLOW_E2E=1`: 1 passed（6.0s、保護者 0 名でも予約完了）
- `pnpm db:push`: `20260423020000_optional_parents.sql` / `20260424000000_club_programs.sql` / `20260424000001_get_my_reservation_program.sql` 適用済み

---

## 1 つ前: 2026-04-23（公開/管理の一覧統合 + ログイン修復 + 招待フロー刷新 + 管理者削除）

### このチャンクで解消したもの
1. **公開 `/` と管理 `/admin/clubs` のクラブ一覧を統一**:
   - 共通コンポーネント `src/components/clubs/club-card.tsx` + `filter-bar.tsx` + `filter-utils.ts`
   - 公開ページにも館 + ステータスの絞り込みフィルタを追加（URL 検索パラメータ）
   - 1 列コンパクトレイアウト（1 画面で見える件数を増加）
2. **ログインが無反応だった問題を修正**:
   - middleware で `/admin` を `/admin/clubs` に書き換え、Server Action 後のダブルリダイレクトを排除
   - `loginAction` が `next=/admin` を `/admin/clubs` に正規化
   - `handleSubmit` で例外を catch し、無言失敗の代わりに日本語メッセージを表示
   - 旧 `src/app/admin/page.tsx`（redirect スタブ）を削除
3. **「管理者の方はこちら」を公開ページ右上に移動**:
   - クラブ数に関わらず常に視線の通る位置に表示される
4. **クラブ登録フォーム説明の `\n` 文字表示を修正**:
   - JSX 属性 `hint="...\n..."` を JSX 式 `hint={"...\n..."}` に切り替え、実際の改行になるよう修正
5. **アカウント追加ページの読点改行を削除**
6. **管理者招待フローを刷新**:
   - 全館管理者が初期パスワードを指定してユーザー作成（`admin.createUser` + `email_confirm: false`）
   - `admin.generateLink(type='signup')` で確認リンクを発行
   - Resend で日本語招待メールを送信（新テンプレート `admin-invite.ts`）
   - 相手は本文のリンクをクリックするとメール確認 + 自動ログインして `/admin/clubs` 着地
   - 新規 Route Handler `src/app/auth/callback/route.ts`（code exchange）
   - `admins` / `admin_facilities` INSERT 途中で失敗したら `deleteUser` で自動ロールバック
7. **管理者削除機能**:
   - `deleteAdminAction` + `DeleteAdminButton` を `/admin/accounts` に追加（全館管理者のみ、自己削除禁止）
   - migration `20260423010000_admin_delete_fk_cleanup.sql`: `audit_logs.admin_id` / `clubs.created_by` の FK を `ON DELETE SET NULL` に変更（履歴保持）
8. **パスワードポリシーを共通化**:
   - `src/lib/auth/password.ts` に `isPasswordStrong` / `PASSWORD_HINT` / `PASSWORD_ERROR`
   - パスワード変更・新規招待の双方で再利用
9. **運用ドキュメント**:
   - `docs/operations.md §3-5` に Supabase Auth の Redirect URL 登録手順を追記

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 13 files / 87 cases pass（vitest-pool の worker 起動 flake 1 件は既知、テスト自体は全 pass）
- `pnpm build`: 13 routes + proxy + auth callback
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_ADMIN_FLOW_E2E=1`: 1 passed（6.6s）
- `RUN_RESERVATION_FLOW_E2E=1`: 1 passed（6.0s）
- `pnpm db:push`: `20260423010000_admin_delete_fk_cleanup.sql` 適用済み

### ユーザー側で必要な追加作業
- **Supabase Studio → Authentication → URL Configuration → Redirect URLs** に `/auth/callback` を登録
  - 本番: `https://<本番ドメイン>/auth/callback`
  - ローカル（任意）: `http://localhost:3000/auth/callback`
  - 未登録だと招待メール内の確認リンクで「redirect_to not allowed」エラーになる

---

## 1 つ前: 2026-04-23（ログイン画面 back-link + エラーメッセージの日本語化）

### このチャンクで解消したもの
1. **`/admin/login` に「← クラブ一覧に戻る」リンクを追加**:
   - ログイン画面から公開のクラブ一覧 (`/`) に戻れるようになった
2. **Supabase Auth の招待エラーを日本語にマッピング**:
   - `translateInviteError()` で「already registered」「invalid email」「rate limit」などのパターンを日本語メッセージに置換
   - 画面に英語が出てしまっていた招待フロー（既存メールで招待しようとした時等）が解消
3. **zod の英語デフォルトメッセージを日本語化**:
   - `clubInputSchema` (name / capacity / targetAge / photoUrl / description の全フィールド)
   - `reservationInputSchema` (parents/children の name/kana, email, notes)
   - `addAdminSchema` (email / displayName / facilityCodes)

### テスト結果
- `pnpm format` / `pnpm typecheck` / `pnpm lint`: all green
- `pnpm test`: 13 files / 88 cases pass
- `pnpm test:e2e`（default）: 13 passed / 2 skipped

---

## 1 つ前: 2026-04-23（管理画面構造変更 + 複数保護者/子どもの正規化 + 用語日本語化）

### このチャンクで解消したもの
1. **管理ダッシュボードを廃止し、ログイン後は直接クラブ一覧へ**:
   - `/admin` は `/admin/clubs` に redirect（互換用）
   - `/admin/clubs` 上部に挨拶 + 館情報 + 全館管理者バッジ + ログアウト + サブナビ（パスワード変更 / アカウント追加）を集約
   - `loginAction` / `createClubAction` / 各 back-link を `/admin/clubs` に統一
2. **クラブ一覧に館 + ステータスの絞り込みフィルタ**:
   - URL 検索パラメータ（`?facility=ozu&status=available`）駆動
   - 未検証の facility / status 値は無視（安全側）
   - 担当館が 1 館のみなら館フィルタは非表示
   - 新規クライアントコンポーネント: `src/app/admin/clubs/filter-bar.tsx`
3. **クラブ一覧を 1 列レイアウトに、公開側カードも幅広に**:
   - 公開 `/`: `grid md:grid-cols-2` → `flex flex-col max-w-2xl`（1 列、視認性向上）
   - 管理 `/admin/clubs`: 行を縦積み、shadow-sm + padding で視認性向上
4. **datetime-local を 10 分刻みに**: `step={1800}` → `step={600}`（新規/編集フォーム）
5. **「super_admin」を UI 文言では「全館管理者」に置換**:
   - バッジ / エラーメッセージ / 説明文を置換（DB の識別子・コメントは維持）
6. **予約に保護者・子どもを複数登録できるよう DB + UI を正規化**:
   - migration `20260423000000_multi_parent_child.sql`:
     - `reservation_parents` / `reservation_children` テーブル（FK + UNIQUE(reservation_id, position) + CHECK 制約、RLS 有効・ポリシー無し）
     - 既存データを position=0 でバックフィル
     - `reservations` から parent_*/child_* の 4 カラムを削除
     - `create_reservation` を `(uuid, text, jsonb, jsonb, text, text, text)` に作り替え、配列を plpgsql で検証
     - `get_my_reservation` は `parents` / `children` を `jsonb_agg ... order by position` で返す
   - 入力 zod: `parents`/`children` 配列（各 1〜10 名、ひらがな検証維持）
   - サーバーラッパ: `createReservation` / `fetchMyReservation` / `notifyReservationPromoted`（admin client の select を parents 関係テーブルに変更）
   - UI: `reservation-form.tsx` に + / - ボタン付きの PeopleSection を実装
   - 確認ページ: 保護者・子どもをそれぞれリスト表示
   - 通知メール: 代表者として保護者 1 人目の名前を使用

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 12 files / 85 cases pass（vitest-pool の worker 起動 flake 1 件は既知、テスト自体は全 pass）
- `pnpm build`: 13 routes + proxy、warning なし
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_RESERVATION_FLOW_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts`: 1 passed（6.2s、実 DB で新スキーマを検証）
- `RUN_ADMIN_FLOW_E2E=1 pnpm test:e2e e2e/admin-flow.spec.ts`: 1 passed（7.0s、新導線に追従）
- `pnpm db:push`: `20260423000000_multi_parent_child.sql` 適用済み

---

## 1 つ前: 2026-04-23（実機レビュー反映: UI 文言整備 + フォーム微調整）

### このチャンクで解消したもの
1. **「予約待ち」→「キャンセル待ち」に統一**（DB enum `waitlisted` はそのまま）:
   - 画面: home / clubs/[id] / clubs/[id]/done / reservations / admin/clubs
   - メール: `waitlisted.ts` / `promoted.ts` の subject + 本文
   - テスト: `templates.test.ts` / `e2e/reservation-flow.spec.ts`
2. **多文パラグラフを文末で改行**（ブラウザで 1 文ごとに視認可能に）:
   - JSX: `。` の切れ目に `<br />` を挿入（home header / empty state / clubs/[id] waitlist / done / reservations / cancel-form / reservation-form preview / new-club / accounts / admin dashboard）
   - 動的メッセージ: `\n` + 表示側に `whitespace-pre-line` を追加
     - password-form hint / login error / cancel-form error / reservation-form error / club-form error+hint / invite-form success / Server Action の message 各種
3. **新規クラブ登録後の遷移先を `/admin` ダッシュボードに変更**:
   - `createClubAction`: revalidate `/admin` も追加、redirect → `/admin`
   - `updateClubAction` / `deleteClubAction` は従来通り `/admin/clubs`
   - `admin-flow.spec.ts` も新フローに追従
4. **パスワードポリシーを 8 文字以上 + 英字 1 + 数字 1 に緩和**:
   - `MIN_PASSWORD_LENGTH = 10` → `8`、`/[^A-Za-z]/` → `/[A-Za-z]/ && /[0-9]/`
   - フォーム hint / Server Action エラー文言も同時更新
5. **管理画面クラブ一覧の担当館表示を館名に**:
   - 旧: `管理対象: 3 館`  →  新: `管理対象: 大洲児童館 / 喜多児童館 / 徳森児童センター`
6. **ダッシュボード h1 を「管理ダッシュボード」に**:
   - 表示名（`○○ さん、お疲れさまです`）は上に小さく残す
   - `admin-flow.spec.ts` の heading 期待も一致するよう更新
7. **新規登録フォームの datetime-local を 30 分刻みに**:
   - `startAt` / `endAt` に `step={1800}` を付与（既存 E2E は `:00` 境界なので影響なし）

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 13 files / 84 cases all pass
- `pnpm build`: 13 routes + proxy、warning なし
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_RESERVATION_FLOW_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts`: 1 passed（4.5s）
- `RUN_ADMIN_FLOW_E2E=1 pnpm test:e2e e2e/admin-flow.spec.ts`: 1 passed（7.7s）

### 現在地
- Phase 1 / 2 / 3: **95%+**
- Phase 4: **80%**（dashboard h1 / clubs list の館名表示 / 登録後ダッシュボード導線）
- Phase 5: **80%**
- **Phase 6: 80%**（前回 75% → 実機レビュー反映で +5）

### 残っている項目（すべて自走外要因）
| 項目 | 種別 | 待ち |
| --- | --- | --- |
| Integration test（RPC 状態遷移・並列） | 技術 | 要 staging Supabase or pg container |
| 権限越権 E2E | 技術 | 2 人目 admin を Supabase Studio で投入してから |
| Rate limit / Bot 対策 | policy | 方針判断待ち（児童館規模で必要かの判断） |
| Dependabot / Sentry | ops | **GitHub 連携 + Vercel 連携 後** |
| Supabase backup plan | ops | プラン確認 |
| License 決定 | 判断 | ユーザー判断 |
| UI モバイル細部のさらなる詰め | polish | 実機フィードバック待ち |

### 次にユーザー操作が必要になる地点
- **本番デプロイを進めるとき**: `docs/operations.md §9` を頭から順に実行すれば 30〜60 分でリリース可能
- **実機検証で気づいた UI / 文言 / UX の指摘**: それを反映する追加タスクが生まれ次第対応
- 特に無ければ、もう **ほぼやり切った状態**（v1 機能 100% 実装 + E2E 検証 + セキュリティヘッダー + CSP + a11y 基本 + 運用 runbook）

### Git
- ブランチ: `main`
- リモート: 未設定
