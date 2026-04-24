# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-24（公開ボタン導入 + 日時入力を 3 フィールドに分割）

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

### テスト結果
- `pnpm format` / `pnpm lint` / `pnpm typecheck`: all green
- `pnpm test`: 14 files / 94 cases pass（vitest worker flake 1 件は既知、ワーカー起動失敗のみ）
- `pnpm build`: 15 routes + proxy
- `pnpm test:e2e`（default）: 13 passed / 2 skipped
- `RUN_ADMIN_FLOW_E2E=1`: 新フロー（program 作成 → クラブ作成（date+time）→ 未公開表示 → 公開ボタン → 公開済み表示 → 編集 → 削除）を 13.1s で green
- `RUN_RESERVATION_FLOW_E2E=1`: 1 passed（7.1s、公開済み既存クラブで予約完了）
- `pnpm db:push`: `20260424000002_clubs_published_at.sql` 適用済み

---

## 1 つ前: 2026-04-24（クラブ・事業マスター化 + 仮想スクロール 他）

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
