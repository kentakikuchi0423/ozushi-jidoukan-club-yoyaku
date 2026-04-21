# architecture

技術スタック、データモデル、主要フローを記述する。
採用理由の詳細は [decisions.md](./decisions.md) に ADR として置く。

---

## 1. 技術スタック（初期案）

| レイヤ | 採用 | 用途 |
| --- | --- | --- |
| ランタイム | Node.js 20 LTS | |
| パッケージマネージャ | pnpm | lockfile の厳格さ・速度 |
| フレームワーク | Next.js 15 (App Router) | SSR / Server Actions / Route Handlers |
| 言語 | TypeScript (strict) | |
| UI | Tailwind CSS + shadcn/ui | 保守しやすさと低コスト |
| DB / Auth | Supabase (PostgreSQL) | 低コスト、RLS、Auth 同梱 |
| ORM / Query | 初期は Supabase JS SDK + SQL migration。必要に応じて Drizzle 検討 | |
| メール | Resend | 開発はテスト送信、本番は独自ドメイン |
| ホスティング | Vercel | Next.js 親和性 / Cron |
| テスト | Vitest + Playwright | |
| 開発環境 | VS Code devcontainer | 再現性 |

## 2. リポジトリ構成（Phase 1 以降の予定）

```
/
├── src/
│   ├── app/
│   │   ├── (user)/            # 利用者向け画面
│   │   │   ├── page.tsx       # クラブ一覧
│   │   │   ├── clubs/[id]/    # 予約入力 → 確認 → 完了
│   │   │   └── reservations/  # 予約確認 / キャンセル
│   │   ├── admin/             # 管理者画面
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── clubs/
│   │   │   ├── accounts/      # super_admin のみ
│   │   │   └── password/
│   │   └── api/               # Route Handlers（必要に応じて）
│   ├── lib/
│   │   ├── db/                # supabase client, queries
│   │   ├── auth/              # server-side session helpers
│   │   ├── mail/              # resend wrapper
│   │   ├── reservations/      # reservation domain logic
│   │   └── validation/        # zod schemas
│   ├── components/            # UI コンポーネント
│   └── server/                # server-only ユーティリティ（重要ロジック）
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── tests/
│   ├── unit/                  # vitest
│   └── e2e/                   # playwright
├── docs/
└── ...
```

## 3. データモデル（初期案）

### 3.1 ER サマリ

```
facilities 1 ── * clubs 1 ── * reservations
admins * ── * facilities  (via admin_facilities)
admins 1 ── * audit_logs
```

### 3.2 テーブル（擬似 DDL）

```sql
-- 施設（固定3件）
create table facilities (
  id         smallint primary key,
  code       text not null unique check (code in ('ozu','kita','toku')),
  name       text not null
);

-- 管理者
create table admins (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  password_hash text,  -- Supabase Auth に委譲する場合は null 可
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- admin と館の多対多（権限）
create table admin_facilities (
  admin_id    uuid not null references admins(id) on delete cascade,
  facility_id smallint not null references facilities(id),
  primary key (admin_id, facility_id)
);

-- クラブ
create table clubs (
  id              uuid primary key default gen_random_uuid(),
  facility_id     smallint not null references facilities(id),
  name            text not null,
  start_at        timestamptz not null,
  end_at          timestamptz not null check (end_at > start_at),
  capacity        integer not null check (capacity > 0),
  target_age_min  integer,
  target_age_max  integer,
  photo_url       text,
  description     text,
  created_at      timestamptz not null default now(),
  created_by      uuid references admins(id),
  deleted_at      timestamptz
);
create index clubs_start_at_desc on clubs (start_at desc);

-- 予約
create type reservation_status as enum ('confirmed','waitlisted','canceled');

create table reservations (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references clubs(id) on delete cascade,
  reservation_number  text not null unique,   -- ozu_123456 等
  secure_token        text not null unique,   -- 32文字以上乱数
  status              reservation_status not null,
  waitlist_position   integer,                -- waitlisted の時のみ採番
  parent_name         text not null,
  parent_kana         text not null,
  child_name          text not null,
  child_kana          text not null,
  phone               text not null,
  email               citext not null,
  notes               text,
  created_at          timestamptz not null default now(),
  canceled_at         timestamptz
);
create index reservations_club_status on reservations (club_id, status);
create index reservations_club_waitlist on reservations (club_id, waitlist_position)
  where status = 'waitlisted';

-- 予約番号の採番用（prefix ごとにシーケンシャル）
create table reservation_number_sequences (
  facility_code text primary key,
  next_value    integer not null default 100000  -- 6桁固定の初期値
);

-- 監査ログ
create table audit_logs (
  id          bigserial primary key,
  admin_id    uuid references admins(id),
  action      text not null,           -- 'club.create','club.update', ...
  target_type text not null,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
```

### 3.3 RLS 方針

- Supabase の **Row Level Security** を原則すべてのテーブルで **ON**
- 利用者クライアント（publishable key、旧 anon key 相当）は以下のみ許可
  - `clubs` の SELECT（`deleted_at is null` かつ `start_at >= now() - interval '1 year'` の条件付きビュー経由）
  - `reservations` の INSERT（ただし実際の予約確定はサーバーサイドの関数で行う）
  - `reservations` の SELECT / UPDATE は **secure_token 一致時のみ** 許可（または Route Handler 経由のみ）
- 管理操作は **secret key（旧 service_role key 相当）を使った Route Handler / Server Action のみ**
- RLS に頼り切らず、アプリ側でも必ず権限チェック（二重化）

## 4. 予約処理フロー

### 4.1 予約確定

```
Client submit
  └→ Server Action: createReservation(clubId, form)
       ├─ zod validate
       ├─ begin transaction
       │   ├─ SELECT ... FOR UPDATE on clubs (row lock)
       │   ├─ count current confirmed
       │   ├─ if count < capacity:
       │   │    status = 'confirmed'
       │   ├─ else:
       │   │    status = 'waitlisted'
       │   │    waitlist_position = max(position) + 1
       │   ├─ generate reservation_number (UPDATE ... RETURNING on reservation_number_sequences)
       │   ├─ generate secure_token (crypto.randomBytes)
       │   └─ INSERT reservations
       └─ send email via Resend (confirmed / waitlisted 区別)
```

- 行ロック + 原子的 UPDATE により定員超過を防止
- 採番は **専用テーブルの原子的 UPDATE RETURNING** で衝突回避
- メール送信は commit 後のタイミングで実施（失敗時は監査ログに残す）

### 4.2 キャンセル

```
Client: 予約番号 + secure_token で accessing
  └→ Server Action: cancelReservation(number, token)
       ├─ verify token
       ├─ check cancellation deadline (2営業日前17時、タイムゾーン: Asia/Tokyo)
       ├─ begin transaction
       │   ├─ UPDATE reservations SET status='canceled', canceled_at=now()
       │   ├─ if 元が 'confirmed':
       │   │    SELECT 先頭 waitlisted (waitlist_position ASC)
       │   │    UPDATE その行 status='confirmed', waitlist_position=null
       │   │    → 繰り上げ通知対象として保持
       │   └─ 繰り上げ対象がいない場合は空き復活のみ
       └─ send cancellation mail + (必要なら) 繰り上げ通知メール
```

### 4.3 Retention Cleanup

- 日次バッチ（Supabase cron または Vercel Cron）
- `delete from clubs where start_at < now() - interval '1 year'`
  - `reservations` は `on delete cascade` で同時削除
- 実行結果を audit_logs に記録

## 5. 認証 / 認可

### 5.1 利用者
- 認証なし。予約確認は `reservation_number + secure_token`（メールリンク）

### 5.2 管理者
- Supabase Auth の email/password で開始（ADR 参照）
- 館権限は `admin_facilities` で管理
- すべての管理系 Route Handler / Server Action で以下を検証
  1. 認証されているか
  2. 対象 facility_id に対する権限があるか
  3. 操作種別（read / write / super_admin）の許可があるか
- super_admin = `admin_facilities` で 3館全てを持つ admin

### 5.3 監査ログに残す操作
- クラブ作成 / 更新 / 削除
- アカウント作成 / 削除 / 権限変更
- パスワード変更
- ログイン失敗の集約（個別メールは残さず件数のみ）

## 6. メール（Resend）

- テンプレート: `confirmed`, `waitlisted`, `promoted`, `canceled`
- 本文には予約番号・クラブ情報・キャンセル期限・確認 URL
- 個人情報のログ回避のため、Resend の metadata には最小限のみ

## 7. 環境変数（.env.example の予定）

```
# Supabase（2025-11 以降の新規プロジェクトは publishable / secret のみ）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # "sb_publishable_..."（旧 anon key の値も可）
SUPABASE_SECRET_KEY=                    # "sb_secret_..."（旧 service_role key の値も可、サーバー専用）

# Resend
RESEND_API_KEY=
RESEND_FROM=

# App
APP_BASE_URL=http://localhost:3000
TIMEZONE=Asia/Tokyo
```

## 8. デプロイ

- Vercel に GitHub 連携でデプロイ
- Preview 環境でもテスト送信メール（`MAIL_SANDBOX=true` 等のフラグ）
- retention cron は Vercel Cron で `/api/cron/retention-cleanup`（サービスロール認証ヘッダ）
