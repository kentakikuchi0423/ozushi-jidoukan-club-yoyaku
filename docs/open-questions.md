# open-questions

未確定事項とその **推奨案** を記録する。決定した事項は `decisions.md` に移す。

優先度は以下の観点で付ける。
- **High**: 仕様の根幹に関わる。早めの決定必要
- **Med**: 実装詳細レベル。該当 Phase 前までに決めれば OK
- **Low**: UI 微調整など、後で決められる

---

## Q2. 予約番号の 6桁部分の採番方式 [High]

- 案A: 館ごとに通し番号（100000 → 999999）。人間可読だが、**予約件数が分かってしまう**
- 案B: 6桁ランダム + 衝突時リトライ。衝突確率は 1/100万 で、満たさなくなってからは桁数拡張
- 推奨: **案A**。人間可読性と推測困難性は secure_token 側で担保する方針。DB 一意制約 + シーケンス専用テーブルの原子更新で衝突なし

## Q3. キャンセル期限「2営業日前17時」の営業日定義 [Resolved 2026-04-25]

- 決定: **土日祝（日本の祝日）を除く**。`@holiday-jp/holiday_jp` で祝日判定
- サーバ側のキャンセル可否判定（`computeCancellationDeadline`）で使用
- 各館の臨時休館日はシステムでは扱わない（クラブ自体を非開催日には登録しないことで吸収）
- UI 表示では具体的な日付・時刻を出さず、固定文言「開催日の 2 営業日前 17 時」のみ
  示す（営業日が館ごとに不定休なので、計算した日付を出すとミスリードになりうる）

## Q4. 写真 URL のドメイン制限 [Med]

- Google Drive だけでなく任意の外部 URL を許容するか
- 推奨: **http/https スキームのみ許可、protocol と host のみ検証**。allowlist は運用開始後に必要性が出たら追加
- `target="_blank" rel="noopener noreferrer"` 必須

## Q5. 予約キャンセル時の「2営業日前17時」超過後の扱い [Resolved 2026-04-26]

- 決定: **管理者キャンセル導線を実装した**（migration `20260425000000`、ADR-0021）。
  - 予約者一覧の active な予約に「キャンセルする」ボタンを表示
  - 押下で `/admin/reservations/[id]/cancel` 確認画面に遷移し、内容と通知メール送信の旨を表示
  - 確認後 `admin_cancel_reservation` RPC を service_role 経由で実行
  - 利用者へ通常のキャンセルメール、必要に応じて waitlist 先頭の繰り上げメールも送信
  - 監査ログ `reservation.admin_cancel` を残す
- 締切（2 営業日前 17 時）の過ぎた予約も管理者は強制キャンセル可能（無連絡欠席や日程変更時の運用想定）
- 無断欠席を追跡するフラグは v1 では持たない

## Q6. 対象年齢の入力形式 [Resolved 2026-04-24]

- 決定: **文字列**（例: "０・１歳児の親子"、"３歳児〜未就学児"）
- 背景: 児童館の既存パンフレットと同じ表記を流用できる方が運用者フレンドリー
- 保管場所: `club_programs.target_age` に text として保持（migration 20260424000000）

## Q7. 予約待ちの上限 [Med]

- 無制限か、定員の N 倍までか
- 推奨: **無制限**（実運用上あまり問題にならない。上限に引っかかる人気クラブが出た時に設計見直し）

## Q8. 保護者 1 人が同じクラブに複数回予約できるか [Med]

- 推奨: **可能とする**（兄弟姉妹で別々に申し込むケースを想定）
- ただし「同一メール + 同一クラブ」の重複は UX として警告を出す

## Q9. 監査ログの長期保持 [Med]

- 要件には明記なし
- 推奨: **3年保持**。retention cleanup 対象は現状クラブ/予約のみ。audit_logs は個別判断

## Q10. メールテンプレートのデザイン [Resolved 2026-04-25]

- 決定: **テキスト + HTML の multipart**（ADR-0016）
- HTML 版は MJML を導入せず、`src/server/mail/templates/shared.ts` の構造化レンダラ
  （`EmailContent` / `Block`）から自前で生成。Outlook 互換のためインラインスタイル
  + `<table>` レイアウト
- テキスト版と HTML 版は同じ構造データから派生させ、差分が出ないように保つ
- 軽量 HTML 化により Resend のサイズ制限の心配もなく、依存も増えない

## Q12. 利用者画面のアクセシビリティ対応レベル [Low]

- 推奨: **WCAG 2.1 AA 相当を目標**。フォントサイズ・コントラスト・キーボード操作の最低線を Phase 6 でチェック

## Q13. GitHub リポジトリを最初から public にするか [Low]

- 推奨: **private でスタート → Phase 6 で public 切替**。secret 混入リスクを下げる
- public 化前に `git log` 全 commit を diff レビュー

## Q14. 予約番号 6 桁の上限（999999）到達時の方針 [Low]

- 現状: `reservation_number_sequences` の CHECK は `100000..1000000`、実払い出しは
  `100000..999999` の 900,000 番／館。アプリ側パーサも 6 桁固定
  （`RESERVATION_NUMBER_REGEX = /^…_(\d{6})$/`）。上限到達時は次回 RPC が
  CHECK 違反で落ち、利用者には 500 が返る（graceful fallback なし）
- スケール感: 1日 10 予約・年中無休でも約 246 年、1日 50 予約でも約 49 年で、
  **現実的に到達しない**
- 番号の再利用: CLAUDE.md 固定要件で「予約番号は全体ユニーク・再利用しない」と
  決めているため、1 年経過後の retention cleanup で空いた番号も**再利用しない**。
  古い確認メールに残る番号と再利用後の番号が衝突して UX が混乱するため
- 推奨: **平時は何もしない**。上限到達が見えてきた時点（実質起きない想定）で、
  下記手順で 7 桁に拡張する。旧 6 桁番号はそのまま有効

### 上限到達時の対応手順（参考）

検知: 利用者からの「予約できない」報告 + サーバログの CHECK 違反エラー
（`reservation_number_sequences_next_value_check`）。1 館でも到達すれば
その館の予約 RPC が落ちる。

対応は新規 migration 1 本 + アプリ側 3 ファイルの改修で済む。

1. **migration 追加**: `next_value` の上限と `reservations.reservation_number`
   の CHECK を緩める
   ```sql
   alter table public.reservation_number_sequences
     drop constraint reservation_number_sequences_next_value_check;
   alter table public.reservation_number_sequences
     add constraint reservation_number_sequences_next_value_check
       check (next_value between 100000 and 10000000);

   alter table public.reservations
     drop constraint reservations_reservation_number_check;
   alter table public.reservations
     add constraint reservations_reservation_number_check
       check (reservation_number ~ '^[a-z][a-z0-9]+_[0-9]{6,7}$');
   ```
2. **`create_reservation` RPC の `lpad` 桁数調整**: 旧 6 桁番号と新 7 桁番号を
   両立させたい場合は `lpad` をやめて `to_char(v_allocated_seq, 'FM999999999')`
   等の可変桁に変更（または「上限到達後は 7 固定」で `lpad(..., 7, '0')` でも可）
3. **`src/lib/reservations/number.ts`**:
   - `RESERVATION_NUMBER_SEQUENCE_MAX = 9_999_999`
   - `RESERVATION_NUMBER_REGEX = /^([a-z][a-z0-9]{1,9})_(\d{6,7})$/`
   - `buildReservationNumber` の桁判定（必要なら `lpad` 相当を調整）
4. **テスト更新**: `number.test.ts` に 7 桁ケースを追加
5. **デプロイ**: 通常の Vercel デプロイで反映。DB migration は Supabase CLI

注意点:
- 1 館だけ先に到達しても他館には影響しない（sequence は館別）
- 旧 6 桁番号は永続的に有効。利用者の手元の確認メールは引き続き機能する
- secure_token の長さは変更しないので URL の互換性は保たれる

---

## 決定済み（decisions.md に移動済み）

- Q1. 管理者認証は Supabase Auth + email/password（ID = メール） → **ADR-0014**（2026-04-22）
- Q11. 管理者セッションは Supabase 既定（access 1h + refresh 自動）、アイドル 24h で強制ログアウト → **ADR-0014** に統合
- Q10. メールテンプレートはテキスト + HTML multipart → **ADR-0016**（2026-04-25）

館マスターの動的化（Q なし、ADR-0018）、クラブと事業の分離（ADR-0019）、公開状態の表現（ADR-0020）、要素リセットの @layer base 化（ADR-0017）は実装フェーズで判断したため open-questions を経由せず直接 ADR 化。
