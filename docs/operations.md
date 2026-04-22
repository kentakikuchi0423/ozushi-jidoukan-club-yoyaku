# operations

運用手順をまとめる。ソフトウェア変更よりもインフラ／Supabase 側の操作が
必要なものを中心に書く。

---

## 1. Supabase プロジェクトのセットアップ

1. <https://supabase.com/dashboard> で新規プロジェクトを作成（リージョンは Tokyo 推奨）。
2. Project Settings → API から以下の 3 値を取得し、`.env.local` に設定する。
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（`sb_publishable_...`）
   - `SUPABASE_SECRET_KEY`（`sb_secret_...`、`NEXT_PUBLIC_` を付けない）
3. Project Settings → Database → Connection string から **Session pooler (port 5432)** の URI を取得し、`[YOUR-PASSWORD]` を DB パスワードに置換して `SUPABASE_DB_URL` に設定する。
   - Direct connection (`db.<ref>.supabase.co`) は IPv6 専用なので devcontainer / CI から到達できない（ADR-0013）。

## 2. Migration の適用

```
pnpm db:push
```

- `scripts/db-push.mjs` が `.env.local` から `SUPABASE_DB_URL` を読み、`supabase` CLI を scratch dir から起動する
- `.env.local` の他の値（secret key など）は CLI に渡さない（godotenv パーサ回避のため）
- Personal Access Token は不要（ADR-0013）

CI で自動適用する場合も同じパターン。GitHub Actions の secret に `SUPABASE_DB_URL` を入れて `pnpm db:push` を叩く。

## 3. 初期 super_admin の bootstrap

Phase 4（管理画面）が無い期間は、Supabase Studio から直接レコードを作る。
`admins` / `admin_facilities` は RLS で自分の行しか見えないため、Studio の
SQL Editor（= secret key 相当）から挿入する。

### 3-1. `auth.users` にアカウントを作成

Supabase Studio → Authentication → Users → **Invite User** または **Add user (create new user)**。
- email: 運用担当者の実メールアドレス
- password: 一時パスワード（初回ログイン後に変更する）

作成された user の `id`（UUID）を控える。

### 3-2. `admins` に対応するプロフィールを INSERT

Supabase Studio → SQL Editor で以下を実行（`<UUID>` は上記 id）:

```sql
insert into public.admins (id, display_name)
values ('<UUID>', '大洲市役所 担当');
```

### 3-3. `admin_facilities` に全 3 館の権限を付与（= super_admin）

```sql
insert into public.admin_facilities (admin_id, facility_id)
values
  ('<UUID>', 1),  -- 大洲児童館
  ('<UUID>', 2),  -- 喜多児童館
  ('<UUID>', 3);  -- 徳森児童センター
```

3 館すべてを持つ admin が super_admin として扱われる（ADR-0007 / 0014）。
以降、アカウント追加は管理画面（Phase 4 実装予定）から super_admin が行う。

### 3-4. 権限の剥奪

管理者を辞めた場合は以下で権限を外す。

```sql
delete from public.admin_facilities where admin_id = '<UUID>';
delete from public.admins where id = '<UUID>';
-- auth.users の削除は Studio の Authentication 画面から行う
```

## 4. Retention cleanup（1 年以上前のクラブ削除 ほか）

`supabase/migrations/20260422010000_retention_cleanup.sql` で以下 2 つの SQL
関数を定義している（ADR 相当の判断は CLAUDE.md §固定要件 と
`docs/open-questions.md` Q9）。

| 関数 | 対象 | デフォルト保持日数 | 最小保持日数 |
| --- | --- | --- | --- |
| `cleanup_expired_clubs(p_keep_days)` | `clubs`（reservations は cascade） | 365 日 | 30 日 |
| `cleanup_old_audit_logs(p_keep_days)` | `audit_logs` | 1095 日（3 年） | 180 日 |

### 手動実行

Supabase Studio → SQL Editor で:

```sql
select public.cleanup_expired_clubs();
select public.cleanup_old_audit_logs();
```

### 自動実行（未実装、Phase 6 で導入予定）

選択肢は 2 つ:

- **Vercel Cron** + Route Handler（推奨）: `/api/cron/retention-cleanup` を作り、
  `SUPABASE_SECRET_KEY` で `supabase-js` 経由に `.rpc('cleanup_expired_clubs')`
  を呼ぶ。`vercel.json` に `crons` 定義を入れ、`CRON_SECRET` ヘッダで保護。
- **pg_cron**（Supabase Studio Database → Extensions）: 有効化後、SQL で
  `cron.schedule('retention-clubs-daily', '0 3 * * *', 'select public.cleanup_expired_clubs();')`
  のように登録。プラン / 制約に注意。

実行結果は `audit_logs` に `retention.cleanup_clubs` / `retention.cleanup_audit_logs`
として記録される（`admin_id = null`）。

## 5. 動作確認用のテストクラブ投入

Phase 4（管理画面）が無い期間は、クラブを Supabase Studio の SQL Editor から
直接 INSERT して動作確認する。個人情報は入れず、名前は「テスト」で始めること。

```sql
-- 翌月開催のテスト用クラブ（大洲児童館 / 定員 2 名）
insert into public.clubs (
  facility_id,
  name,
  start_at,
  end_at,
  capacity,
  target_age_min,
  target_age_max,
  photo_url,
  description
) values (
  1,  -- 1=大洲児童館、2=喜多児童館、3=徳森児童センター
  'テスト用 こども英会話（初級）',
  (now() + interval '30 days')::date + time '10:00' at time zone 'Asia/Tokyo',
  (now() + interval '30 days')::date + time '12:00' at time zone 'Asia/Tokyo',
  2,
  3,
  6,
  null,
  E'動作確認用のテストクラブです。実際の開催予定ではありません。\n\nお気軽にご参加ください。'
);

-- 登録されたか確認（id を控える）
select id, facility_id, name, start_at, capacity
  from public.clubs
  where name like 'テスト用%'
  order by created_at desc
  limit 5;
```

確認後、クラブ一覧ページ（`/`）で該当クラブが表示されれば OK。
動作確認を終えたら:

```sql
-- 該当クラブと紐づく予約（cascade 対象）まとめて削除
delete from public.clubs where name like 'テスト用%';
```

## 6. Resend（メール送信）

`src/server/mail/` が `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` を見てメールを
送る。どちらも未設定なら `console.warn` で「スキップした」旨だけ記録して
no-op になる。

### 未検証ドメインでのテスト送信

Resend の「未検証ドメイン」運用時は以下の制約がある:

- `From:` は `onboarding@resend.dev` のみ許可される
- `To:` は **Resend アカウント作成時のメールアドレス** にしか届かない（それ以外は API が 403 で失敗する）

したがって、テスト時は予約フォームの「メールアドレス」欄に Resend
アカウント所有者のメールアドレスを入れること。本番運用前に Resend で
送信元ドメインを検証（SPF / DKIM / DMARC）し、`RESEND_FROM_ADDRESS` を
自社ドメイン（例: `no-reply@ozu-city.example.jp`）に差し替える。

### 送信内容のカテゴリ

| タグ | 送信タイミング | 送信先 |
| --- | --- | --- |
| `reservation.confirmed` | 予約確定時 | お申込み者 |
| `reservation.waitlisted` | 予約待ち入り時 | お申込み者 |
| `reservation.promoted` | キャンセルで繰り上がった時 | 繰り上がった人 |
| `reservation.canceled` | キャンセル手続き完了時 | キャンセル実行者 |

## 7. DB パスワードの再発行

Supabase Studio → Project Settings → Database → **Reset database password**。
発行後は `.env.local` の `SUPABASE_DB_URL` を新パスワードで書き換える（DB URL
のパスワード部分のみ差し替えれば OK）。

## 8. Secret key の再発行（万一流出した場合）

1. Studio → Project Settings → API → `sb_secret_...` を **Revoke** → 新キー発行
2. `.env.local` の `SUPABASE_SECRET_KEY` を更新
3. Vercel にデプロイ済みなら Vercel 側の env も更新して再デプロイ
4. 流出時は `audit_logs` を確認し、不正操作の有無を調査
