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
values ('<UUID>', 'システム管理者');
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
以降、アカウント追加は管理画面（`/admin/accounts`）から全館管理者が行う。

### 3-5. Supabase Auth の Redirect URL に `/auth/callback` を登録

新規アカウント招待時、`generateLink(type='signup')` が発行する確認リンクが
`https://<site>/auth/callback?code=...&next=/admin/clubs` に帰ってくるため、
このパスを **Supabase Studio → Authentication → URL Configuration → Redirect URLs** に
追加しておく（ローカル開発なら `http://localhost:3000/auth/callback` も追加）。
登録していないとリンククリック時に「redirect_to not allowed」エラーになる。

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

### 自動実行（Vercel Cron、実装済み）

Vercel Cron + Route Handler（`src/app/api/cron/retention-cleanup/route.ts`）
で毎日 18:00 UTC（= 翌 03:00 JST）に起動するよう `vercel.json` に登録済み。
本体は `cleanup_expired_clubs` + `cleanup_old_audit_logs` の RPC を順に叩くだけ。

**本番デプロイ前に必ず設定すること**:

1. 32 バイト以上のランダム文字列を用意（例: `openssl rand -base64 48`）
2. Vercel Dashboard → Project Settings → Environment Variables で
   `CRON_SECRET` を追加（production + preview）
3. Vercel Dashboard → Cron Jobs で `/api/cron/retention-cleanup` がスケジュール
   登録されていることを確認

`CRON_SECRET` が未設定のままだとエンドポイントは 503 を返すだけで何もしない
（ステージングや dev で誤って叩いても安全）。実行結果は `audit_logs` に
`retention.cleanup_clubs` / `retention.cleanup_audit_logs` として記録される
（`admin_id = null`）。

### pg_cron（別案）

Vercel Cron を使わない場合は Supabase Studio → Database → Extensions で
`pg_cron` を有効化し、以下のように登録する:

```sql
select cron.schedule(
  'retention-clubs-daily',
  '0 18 * * *',
  $$ select public.cleanup_expired_clubs(); $$
);
```

ただし Supabase の無料プランでは `pg_cron` は利用不可。

## 5. 動作確認用のテストクラブ投入

Phase 4（管理画面）が無い期間は、クラブを Supabase Studio の SQL Editor から
直接 INSERT して動作確認する。個人情報は入れず、名前は「テスト」で始めること。

```sql
-- クラブ名・対象年齢・概要は club_programs マスターから参照する。
-- 名前が無ければ先にマスターを作る（seed 済みの「にこにこクラブ」を使っても可）。
insert into public.club_programs (name, target_age, summary)
values (
  'テスト用 こども英会話（初級）',
  '３歳児〜未就学児',
  E'動作確認用のテストクラブです。\n実際の開催予定ではありません。'
)
on conflict (name) do nothing;

-- 翌月開催のテスト用クラブ（大洲児童館 / 定員 2 名 / 即時公開）
-- published_at を now() でセットすれば公開画面に即表示される。
-- 未公開で入れたい場合は published_at = null のまま残し、/admin/clubs の
-- 「公開する」ボタンで公開する運用でも OK。
insert into public.clubs (
  facility_id,
  program_id,
  start_at,
  end_at,
  capacity,
  photo_url,
  description,
  published_at
) values (
  1,  -- 1=大洲児童館、2=喜多児童館、3=徳森児童センター
  (select id from public.club_programs where name = 'テスト用 こども英会話（初級）'),
  (now() + interval '30 days')::date + time '10:00' at time zone 'Asia/Tokyo',
  (now() + interval '30 days')::date + time '12:00' at time zone 'Asia/Tokyo',
  2,
  null,
  E'当日の補足: 雨天時は大洲児童館 2F 会議室に変更します。',
  now()
);

-- 登録されたか確認（id を控える）
select c.id, c.facility_id, cp.name, c.start_at, c.capacity, c.published_at
  from public.clubs c
  join public.club_programs cp on cp.id = c.program_id
  where cp.name like 'テスト用%'
  order by c.created_at desc
  limit 5;
```

確認後、クラブ一覧ページ（`/`）で該当クラブが表示されれば OK。
動作確認を終えたら:

```sql
-- 該当クラブと紐づく予約（cascade 対象）まとめて削除
delete from public.clubs
 where program_id in (
   select id from public.club_programs where name like 'テスト用%'
 );
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

## 9. 本番デプロイ runbook（初回）

最短でクリーンに本番に出すための手順。所要 30〜60 分。

### 9-1. 前提チェック
- Supabase プロジェクトが「Tokyo リージョン」「Pro もしくは Free」で作成済み
- ローカル `.env.local` が揃っていて、`pnpm build && pnpm test:e2e` が通る
- Resend アカウント + 送信元ドメインの検証が済んでいる（未検証なら `onboarding@resend.dev` で限定送信のみ可。§6 参照）

### 9-2. GitHub リポジトリ作成（初回のみ）
```bash
# ローカル main ブランチから
gh auth login            # 未ログインなら
gh repo create <owner>/ozushi-jidoukan-club-yoyaku --private --source=. --remote=origin
git push -u origin main
```

公開前に `git log -p` で secrets / 個人情報 / `.env*` が混ざっていないことを必ず確認する。

### 9-3. Vercel 連携
1. <https://vercel.com/new> で GitHub 連携 → 該当リポジトリを選択
2. Framework Preset: Next.js（自動判定）。ルートや build command はそのまま
3. **Environment Variables** に以下を投入（全ての環境: Production + Preview）:
   ```
   NEXT_PUBLIC_SUPABASE_URL             = https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
   SUPABASE_SECRET_KEY                  = sb_secret_...            (Encrypted)
   NEXT_PUBLIC_SITE_URL                 = https://<your-domain>
   RESEND_API_KEY                       = re_...                   (Encrypted)
   RESEND_FROM_ADDRESS                  = "<display> <from@domain>"
   CRON_SECRET                          = `openssl rand -base64 48` (Encrypted)
   ```
   - `SUPABASE_DB_URL` / `ADMIN_BOOTSTRAP_*` は本番では使わない（ローカルと migration のみ）
4. Deploy を実行 → ビルド成功を確認
5. Vercel の **Settings → Cron Jobs** を開き、`/api/cron/retention-cleanup` が登録されていることを確認（`vercel.json` 由来で自動登録される）

### 9-4. 本番 DB に migration を流す
**ローカル** から:
```
# .env.local の SUPABASE_DB_URL が本番を指していることを確認してから
pnpm db:push
```
適用済みの migration はスキップされる。新しい migration を足したら毎回流す。

### 9-5. 初期 super_admin の作成
§3 の手順で Supabase Studio から実施。本番の `auth.users` + `admins` + `admin_facilities` にレコードを入れる。

### 9-6. 動作確認チェックリスト（本番）
| 確認 | 想定結果 |
| --- | --- |
| `https://<domain>/` を開く | クラブ一覧（最初は空）、セキュリティヘッダーあり、CSP nonce 発行 |
| `/admin/login` → super_admin でログイン | ダッシュボードに到達、3 館バッジ |
| `/admin/clubs/new` でテストクラブ登録 | `/` の一覧に即時反映 |
| トップから「予約する」→ 自分のメールで予約 | 完了画面 + 確認メール受信（Resend の送信先制限に注意） |
| `/reservations?r=...&t=...` で予約を表示 | 予約内容とキャンセル期限が表示 |
| キャンセル | キャンセルメール受信、UI もキャンセル済み表示 |
| `/admin/clubs` でテストクラブを削除 | `/` から消える、`audit_logs` に `club.delete` |
| 別ブラウザ（シークレット）で `/admin` | `/admin/login?next=/admin` に redirect |
| `curl https://<domain>/api/cron/retention-cleanup` | 401（Bearer なし）、`Authorization: Bearer <CRON_SECRET>` 付きで 200 |

### 9-7. 本番で Resend ドメインを本検証に切替
1. Resend → Domains → 自社ドメインを追加 → DNS（SPF / DKIM / DMARC）を登録 → Verified
2. Vercel env の `RESEND_FROM_ADDRESS` を自社ドメイン From に差し替え（例: `"大洲市児童館予約 <no-reply@<domain>>"`）
3. 再デプロイ後、送信先が Resend アカウントメール以外でも届くことを確認

### 9-8. 運用開始後のメンテ
- Supabase の **Database → Backups**（Pro 以上で PITR、Free は日次 7 日）を確認
- GitHub で Dependabot を有効化（Settings → Security → Dependabot alerts / security updates）
- Vercel で Cron Jobs の実行履歴を週次で確認し、`audit_logs` に cleanup エントリが残っていること
- 月次で `pnpm audit` を実行し脆弱性を検知
- 月次で `admin.login.*` の監査ログを tail（下記 §10 参照）
- 初回の super_admin 以外の管理者は `/admin/accounts` から招待する

---

## 10. 監査ログの tail 手順

`audit_logs` は改ざん防止のため SELECT のみ許可（admin クライアント経由）。Supabase Studio の **SQL Editor** で下記を貼って実行する。個人情報は JSON の `metadata` に限定的に入るため、スクリーンショット共有時はマスク推奨。

### 10-1. 直近 1 ヶ月の管理者ログイン（成功 / 失敗）
```sql
select
  created_at,
  action,
  metadata->>'email'  as email,
  metadata->>'ip'     as ip,
  metadata->>'reason' as reason
from public.audit_logs
where action in ('admin.login.succeeded', 'admin.login.failed')
  and created_at >= now() - interval '30 days'
order by created_at desc
limit 200;
```

### 10-2. 同一 email への連続失敗（brute force 疑い）
```sql
select
  metadata->>'email' as email,
  count(*)           as failures,
  min(created_at)    as first_at,
  max(created_at)    as last_at
from public.audit_logs
where action = 'admin.login.failed'
  and created_at >= now() - interval '24 hours'
group by metadata->>'email'
having count(*) >= 5
order by failures desc;
```

5 回以上失敗している email があれば、当該管理者に連絡して心当たり確認。必要なら Supabase Studio の **Authentication → Users** で該当ユーザーを一時的に Disable する。

### 10-3. 館マスター / アカウント管理の変更履歴
```sql
select
  created_at,
  action,
  target_id,
  metadata
from public.audit_logs
where action like 'facility.%' or action like 'admin.%'
order by created_at desc
limit 100;
```

### 10-4. Cron retention cleanup の実行履歴
```sql
select created_at, action, metadata
from public.audit_logs
where action like 'retention.%'
order by created_at desc
limit 30;
```

---

## 11. リリース前の受入テスト

リリース前には `docs/acceptance-tests.md` の 18 本のシナリオに沿って、人の目で動作確認する。利用者シナリオ 8 本 + 管理者シナリオ 10 本。★ マークがあるものは Playwright で自動化済み。

```bash
# default（smoke + permission-guard）
pnpm test:e2e

# 実 DB に書き込むフロー（opt-in）
RUN_ADMIN_FLOW_E2E=1 pnpm test:e2e e2e/admin-flow.spec.ts
RUN_RESERVATION_FLOW_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts
RUN_WAITLIST_E2E=1 E2E_WAITLIST_CLUB_ID=<capacity=1 のクラブ id> pnpm test:e2e e2e/reservation-flow.spec.ts
RUN_PERMISSION_E2E=1 pnpm test:e2e e2e/permission-guard.spec.ts
```

手動で確認するもの:
- 受付期限後のクラブ（A-4）
- 他人の予約番号に無効 token を付けた 404（A-5）
- キャンセル期限超過時のブロック（A-6）
- 未公開クラブが利用者に見えない（A-7）
- 写真リンクの表示切替（A-8）
- 削除済み館のクラブの参照整合性（B-7）
- アカウント招待の実メール受信（B-8、Resend ダッシュボードで）
- パスワード変更後の再ログイン（B-9）
