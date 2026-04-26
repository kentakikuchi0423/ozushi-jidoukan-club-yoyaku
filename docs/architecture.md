# architecture

技術スタック、データモデル、主要フローを記述する。
**本ファイルは実装済みの状態を反映する**（2026-04 時点、Phase 2–6 実装後）。
採用理由の詳細は [decisions.md](./decisions.md) に ADR として置く。

---

## 1. 技術スタック（実装済み）

| レイヤ | 採用 | 用途 |
| --- | --- | --- |
| ランタイム | Node.js 20 LTS | |
| パッケージマネージャ | pnpm 10 | lockfile の厳格さ・速度（ADR-0003） |
| フレームワーク | Next.js 16.2 (App Router) | RSC / Server Actions / Route Handlers（ADR-0001） |
| 言語 | TypeScript 5 (strict) | |
| UI | Tailwind CSS v4 + 自前 UI プリミティブ（`src/components/ui/`） | 配色は CSS 変数（`@theme`）で集中管理、要素リセットは `@layer base` 内（ADR-0017） |
| DB / Auth | Supabase (PostgreSQL / Auth / RLS) | 低コスト、RLS、Auth 同梱（ADR-0002, 0014） |
| Query | Supabase JS SDK + SQL migration | RPC と SECURITY DEFINER 関数で特権処理（ADR-0004, 0005） |
| 日付 | `date-fns-tz` + `@holiday-jp/holiday_jp` | JST 業務日計算（ADR-0010）。UI 表示は固定文言、サーバ側のキャンセル可否判定でのみ営業日計算を使う |
| バリデーション | zod 4 | クライアント／サーバー二重検証 |
| メール | Resend 6 | 5 テンプレート（confirmed / waitlisted / promoted / canceled / admin-invite）。利用者向け 4 本は text + HTML を multipart で送信（ADR-0016） |
| ホスティング | Vercel | Next.js 親和性 + Cron |
| テスト | Vitest 4 + Playwright 1.59 | ユニット + E2E（ADR-0009） |
| 開発環境 | VS Code devcontainer | 再現性 |

## 2. リポジトリ構成（実装済み）

```
.
├── src/
│   ├── app/
│   │   ├── page.tsx                       # 利用者トップ（クラブ一覧）
│   │   ├── layout.tsx                     # skip-to-content、Noto Sans JP、noindex
│   │   ├── clubs/
│   │   │   ├── [id]/page.tsx              # クラブ詳細 + 予約フォーム
│   │   │   ├── [id]/reservation-form.tsx  # Client Component (draft→preview)
│   │   │   ├── [id]/actions.ts            # createReservationAction
│   │   │   └── [id]/done/page.tsx         # 予約完了
│   │   ├── reservations/
│   │   │   ├── page.tsx                   # 予約確認（r + t クエリ）
│   │   │   ├── cancel-form.tsx
│   │   │   └── actions.ts                 # cancelReservationAction
│   │   ├── admin/
│   │   │   ├── page.tsx                   # ダッシュボード
│   │   │   ├── actions.ts                 # logoutAction
│   │   │   ├── login/                     # ログインフォーム + Server Action（監査ログ付き）
│   │   │   ├── clubs/                     # CRUD（list / new / [id]/edit / 公開トグル / [id]/reservations）
│   │   │   ├── reservations/[id]/cancel/  # 管理者キャンセル確認画面 + Server Action（ADR-0021）
│   │   │   ├── programs/                  # 事業マスター CRUD（全 admin）
│   │   │   ├── facilities/                # 館の CRUD（super_admin のみ、ADR-0018）
│   │   │   ├── password/                  # パスワード変更
│   │   │   └── accounts/                  # super_admin のみ: 招待
│   │   ├── api/cron/
│   │   │   └── retention-cleanup/route.ts # Vercel Cron の入口
│   │   └── middleware.ts                  # session refresh + /admin ガード + CSP nonce
│   ├── components/
│   │   ├── ui/                            # Button / Card / Field / Input / Badge / FormMessage / Select / Textarea
│   │   └── clubs/                         # ClubCard / ClubFilterBar / DateMultiPicker / PaginatedClubList
│   ├── lib/                               # UI 非依存（client / server 共用）
│   │   ├── clubs/                         # ClubListing 型 / query / input-schema
│   │   ├── facility.ts                    # 館コードのフォーマット検証のみ（マスターは DB で動的、ADR-0018）
│   │   ├── format.ts                      # JST 日時フォーマッタ + datetime-local / YYYY-MM-DD 変換
│   │   ├── reservations/                  # 予約番号 / status / 入力 schema / キャンセル締切
│   │   ├── env.ts                         # NEXT_PUBLIC_ 環境変数
│   │   └── supabase/                      # browser / server クライアント（publishable）
│   └── server/                            # server-only（secret key 参照）
│       ├── auth/                          # session / guards / permissions / profile / admin-list / super-admin
│       ├── audit/log.ts                   # logAdminAction
│       ├── clubs/admin-detail.ts          # admin 向け単一取得
│       ├── env.ts                         # SUPABASE_SECRET_KEY / RESEND_* / CRON_SECRET
│       ├── facilities/                    # fetchFacilities / fetchActiveFacilityContacts
│       ├── mail/                          # send + 5 templates（confirmed / waitlisted / promoted / canceled / admin-invite） + notify
│       ├── reservations/                  # create / cancel / lookup / secure-token / admin-cancel / admin-detail / admin-list
│       └── supabase/admin.ts              # secret key クライアント（RLS バイパス）
├── supabase/
│   ├── config.toml
│   ├── migrations/                        # 15 本（initial / rpcs / retention / listing / detail / lookup / fixes / multi_parent_child / fk_cleanup / optional_parents / club_programs / get_my_reservation_program / clubs_published_at / facility_phone_and_dynamic / admin_cancel_reservation）
│   └── seed.sql                           # placeholder（PII 禁止方針）
├── scripts/db-push.mjs                    # `pnpm db:push` ラッパ
├── e2e/                                   # Playwright: smoke / permission-guard / reservation-flow / admin-flow
├── docs/                                  # 要件・アーキ・ADR・運用・テスト・セキュリティ
├── vercel.json                            # Cron スケジュール
├── next.config.ts                         # セキュリティヘッダー
└── .claude/                               # Claude Code の設定・エージェント・スキル
```

## 3. データモデル（実装済み）

### 3.1 ER サマリ

```
facilities 1 ── * clubs 1 ── * reservations
auth.users 1 ── 1 admins * ── * facilities (via admin_facilities)
admins 1 ── * audit_logs
reservation_number_sequences (facility_code PK)
```

### 3.2 テーブル（実装済み DDL 抜粋、詳細は `supabase/migrations/20260421000000_initial_schema.sql`）

```sql
-- 館（migration 20260424000003 で phone / deleted_at を追加。マスターは動的、ADR-0018）
create table public.facilities (
  id smallint primary key,
  code text not null unique check (code ~ '^[a-z0-9_]+$' and length(code) between 1 and 32),
  name text not null check (length(name) between 1 and 100),
  phone text not null check (length(phone) between 1 and 30),
  deleted_at timestamptz
);

-- 管理者は auth.users の拡張プロフィール（ADR-0014）
create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_facilities (
  admin_id uuid not null references public.admins(id) on delete cascade,
  facility_id smallint not null references public.facilities(id),
  primary key (admin_id, facility_id)
);

-- クラブ・事業マスター（migration 20260424000000 で追加）。
-- 名称・対象年齢・概要はここから JOIN で取り出す。削除はソフト削除。
create table public.club_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 100),
  target_age text not null check (length(target_age) between 1 and 100),
  summary text not null check (length(summary) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  facility_id smallint not null references public.facilities(id),
  program_id uuid not null references public.club_programs(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  capacity integer not null check (capacity > 0 and capacity <= 1000),
  photo_url text check (photo_url is null or photo_url ~ '^https?://'),
  -- その回固有の補足（概要とは別）。
  description text check (description is null or length(description) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid references public.admins(id),
  deleted_at timestamptz,
  -- 公開制: NULL は下書き、タイムスタンプが入ると公開中。
  -- 管理画面の「公開する」ボタンで now() を入れる。
  published_at timestamptz
);

create type public.reservation_status as enum ('confirmed','waitlisted','canceled');

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  reservation_number text not null unique
    -- 初期 migration では `(ozu|kita|toku)_` 固定だったが、館マスター動的化（ADR-0018,
    -- migration 20260424000003）で `^[a-z][a-z0-9]+_[0-9]{6}$` に緩和済み。
    check (reservation_number ~ '^[a-z][a-z0-9]+_[0-9]{6}$'),
  secure_token text not null unique check (length(secure_token) >= 32),
  status public.reservation_status not null,
  waitlist_position integer,
  phone text not null check (phone ~ '^[0-9+\-() ]{7,20}$'),
  email citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  check ((status = 'waitlisted' and waitlist_position is not null and waitlist_position > 0)
         or (status <> 'waitlisted' and waitlist_position is null)),
  check ((status = 'canceled' and canceled_at is not null)
         or (status <> 'canceled' and canceled_at is null))
);

-- 1 予約に保護者・子どもを複数人紐付けるための関係テーブル
-- （migration 20260423000000 で追加）。position で並び順を保証する。
create table public.reservation_parents (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  position smallint not null check (position >= 0 and position < 20),
  name text not null check (length(name) between 1 and 100),
  kana text not null check (length(kana) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (reservation_id, position)
);
create table public.reservation_children (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  position smallint not null check (position >= 0 and position < 20),
  name text not null check (length(name) between 1 and 100),
  kana text not null check (length(kana) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (reservation_id, position)
);

-- 重要: (club_id, waitlist_position) は waitlisted 限定で unique
create unique index reservations_club_waitlist_unique
  on public.reservations (club_id, waitlist_position)
  where status = 'waitlisted';

-- 予約番号採番（1 行 per 館、UPDATE ... RETURNING でアトミック）
create table public.reservation_number_sequences (
  facility_code text primary key references public.facilities(code),
  next_value integer not null default 100000
    check (next_value between 100000 and 1000000)
);

create table public.audit_logs (
  id bigserial primary key,
  admin_id uuid references public.admins(id),
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### 3.3 RLS 方針（実装済み）

すべてのテーブルで RLS を ON。policy の有無とロールの組み合わせで許可を決める:

- **facilities**: anon / authenticated に SELECT 許可（公開マスタ）
- **clubs**:
  - `clubs_select_public`: anon / authenticated に `deleted_at is null and start_at >= now() - interval '1 year'` の SELECT
  - `clubs_admin_facility`: authenticated で `admin_facilities` に該当館を持つ admin に CRUD 許可
- **reservations**: policy 未定義 → anon / authenticated からは一切見えない。`get_my_reservation` / `create_reservation` / `cancel_reservation` の SECURITY DEFINER 関数だけがアクセス
- **reservation_parents** / **reservation_children**: reservations と同様に policy 未定義。RPC 経由でのみ書き込み・読み取り可能
- **admins**: 認証済みユーザは自分の行だけ SELECT
- **admin_facilities**: 認証済みユーザは自分の行だけ SELECT
- **reservation_number_sequences**: policy 無し → secret key のみ
- **audit_logs**: 認証済みユーザは自分の監査ログだけ SELECT。INSERT / UPDATE / DELETE は secret key 経由のみ

RLS に頼り切らず、Server Action / Route Handler 側でも `requireAdmin` / `requireFacilityPermissionOrThrow` / `requireSuperAdmin` で二重にチェックする。

### 3.4 SECURITY DEFINER 関数（実装済み）

| 関数 | 呼び元 | 役割 |
| --- | --- | --- |
| `create_reservation(club_id, secure_token, parents jsonb, children jsonb, phone, email, notes)` | `supabase.rpc` from server client | `clubs FOR UPDATE` + 容量判定 + 連番採番 + 予約 INSERT + 保護者/子どもの関係テーブル INSERT |
| `cancel_reservation(reservation_number, secure_token)` | 同上 | 利用者向け：トークン検証 + キャンセル + 繰り上げ |
| `admin_cancel_reservation(reservation_id)` | admin client（service_role） | 管理者向け：reservation_id でキャンセル + 繰り上げ。EXECUTE は service_role のみ（ADR-0021） |
| `get_my_reservation(reservation_number, secure_token)` | 同上 | 予約確認画面の読み取り |
| `list_public_clubs()` | 同上 | 利用者向けクラブ一覧（件数集計つき） |
| `get_public_club(id)` | 同上 | クラブ詳細 1 件 |
| `cleanup_expired_clubs(keep_days default 365)` | Vercel Cron（secret key） | retention |
| `cleanup_old_audit_logs(keep_days default 1095)` | 同上 | retention |

すべて `set search_path = public, pg_temp` を設定し、anon/authenticated には必要最小限だけ EXECUTE を GRANT。

## 4. 予約処理フロー

### 4.1 予約確定（実装済み）

```
Client: /clubs/[id] のフォーム submit
  └→ Server Action: createReservationAction(clubId, input)
       ├─ zod validate (reservationInputSchema)
       ├─ generate secure_token (Web Crypto, 32 bytes base64url)
       ├─ RPC: create_reservation(club_id, secure_token, parents[], children[], phone, email, notes)
       │   ├─ SELECT ... FOR UPDATE on clubs
       │   ├─ count confirmed → status = 'confirmed' or 'waitlisted'
       │   ├─ UPDATE reservation_number_sequences SET next_value = next_value + 1
       │   │     RETURNING next_value - 1
       │   ├─ INSERT reservations
       │   └─ INSERT reservation_parents / reservation_children（position 順）
       ├─ notifyReservationCreated (confirmed / waitlisted のテンプレ分岐、fire-and-forget)
       └─ redirect → /clubs/[id]/done?r=...&t=...&s=...&p=...
```

### 4.2 キャンセル + 繰り上げ（利用者経路、実装済み）

```
Client: /reservations?r=...&t=... の「キャンセルする」
  └→ Server Action: cancelReservationAction(r, t)
       ├─ fetchMyReservation(r, t) でトークン検証 + キャンセル前の情報を snapshot
       ├─ isCancellable(clubStartAt) で 2 営業日前 17:00 JST を確認（祝日含む）
       ├─ RPC: cancel_reservation(r, t)
       │   ├─ SELECT reservations FOR UPDATE (token 一致)
       │   ├─ UPDATE status='canceled', canceled_at=now()
       │   └─ if 元が confirmed: clubs FOR UPDATE 取得 → waitlist 先頭を confirmed に昇格
       ├─ notifyReservationCanceled (fire-and-forget)
       └─ if promotion が発生: notifyReservationPromoted（相手の secure_token を admin client で取得）
```

### 4.3 キャンセル + 繰り上げ（管理者経路、実装済み、ADR-0021）

```
Admin: /admin/clubs/[id]/reservations の「キャンセルする」
  └→ /admin/reservations/[id]/cancel  確認画面（reservation_id をパスから取る）
        ├─ fetchAdminReservationDetail(id) で予約 + クラブ + 館 + 保護者・子どもを 1 クエリ
        ├─ requireFacilityPermission(facilityCode) で対象館の権限チェック
        └─ form submit
            └→ Server Action: adminCancelReservationFormAction(id, formData)
                 ├─ requireFacilityPermission を再チェック（render と submit の権限ズレに保険）
                 ├─ RPC: admin_cancel_reservation(reservation_id)（service_role のみ実行可）
                 │   ├─ SELECT reservations FOR UPDATE
                 │   ├─ UPDATE status='canceled', canceled_at=now()
                 │   └─ if 元が confirmed: clubs FOR UPDATE → waitlist 先頭を昇格
                 ├─ notifyReservationCanceled / notifyReservationPromoted（利用者経路と同じテンプレ）
                 ├─ logAdminAction(reservation.admin_cancel)（個人情報はメタに含めない）
                 └─ revalidatePath + redirect → 一覧?canceled=1
```

利用者経路と異なり、管理者経路では締切（2 営業日前 17:00）の判定を**行わない**。
締切後の無連絡欠席や日程変更時の強制キャンセルが主な運用想定。

### 4.4 Retention cleanup（実装済み）

- Vercel Cron が日次 18:00 UTC（= 翌 03:00 JST）に `/api/cron/retention-cleanup` を GET
- Route Handler が `Bearer <CRON_SECRET>` を検証し、`cleanup_expired_clubs()` + `cleanup_old_audit_logs()` を順に呼ぶ
- 実行結果は `audit_logs` に `retention.cleanup_clubs` / `retention.cleanup_audit_logs`（`admin_id = null`）で残る

## 5. 認証 / 認可（実装済み）

### 5.1 利用者
- 認証なし。予約確認は `reservation_number + secure_token`（メール本文の URL 経由）
- `get_my_reservation(r, t)` RPC が両方一致時のみ行を返す

### 5.2 管理者
- Supabase Auth の email/password で認証（ADR-0014）。ID = メールアドレス
- `@supabase/ssr` の cookie ベースセッション。middleware で毎リクエスト refresh
- 館権限は `admin_facilities` で管理（ADR-0007）
- Server Action / RSC の冒頭で `requireAdmin` / `requireFacilityPermissionOrThrow` / `requireSuperAdmin` を呼ぶ
- `/admin/*` は middleware が未ログイン時に `/admin/login?next=...` へリダイレクト

### 5.3 監査ログに残す操作（実装済み）
- クラブ: `club.create` / `club.update` / `club.delete` / `club.publish`
- 事業マスター: `program.create` / `program.update` / `program.delete`
- 館: `facility.create` / `facility.update` / `facility.delete`
- 予約: `reservation.admin_cancel`（管理者によるキャンセル、ADR-0021）
- アカウント: `admin.create` / `admin.password_change` / `admin.login.succeeded` / `admin.login.failed`
- リテンション: `retention.cleanup_clubs` / `retention.cleanup_audit_logs`

PII（氏名・電話・メール）は原則 metadata に含めない。`admin.create` は招待時のメール
と館コードだけ残す（identification 用）。`admin.login.failed` は入力 email と
Supabase エラーコードを残す（パスワード自体はログに出さない）。

## 6. メール（Resend）

| タグ | テンプレート | 送信先 | 内容 |
| --- | --- | --- | --- |
| `reservation.confirmed` | `confirmed.ts` | 申込者 | 予約番号、日時、確認・キャンセル URL、キャンセル期限の説明 |
| `reservation.waitlisted` | `waitlisted.ts` | 申込者 | 予約番号、日時、順位、確認・取り消し URL |
| `reservation.promoted` | `promoted.ts` | 繰り上がった人 | 繰り上がり通知、日時、確認 URL |
| `reservation.canceled` | `canceled.ts` | キャンセル実行者 | キャンセル受領、日時（URL は含めない） |
| `admin.invite` | `admin-invite.ts` | 新規 admin | 担当館の一覧、初回ログイン用ワンタイムリンク |

利用者向け 4 本（confirmed / waitlisted / promoted / canceled）は **テキスト + HTML
の multipart**（ADR-0016）。`src/server/mail/templates/shared.ts` の構造化レンダラ
（`EmailContent` / `Block`）から両方を機械生成し差分を出さない。HTML 版は中央
寄せのカード + 緑の CTA ボタンで URL をクリッカブルに表示する。先頭に「このメール
は予約システムから自動送信しています。」の固定注記、フッターに全館の連絡先
（`facilities.phone` を fetchActiveFacilityContacts で取得）を載せる。

管理者招待メール（admin-invite）は別系統のテキスト構造のため `textToHtml` 経由で
HTML 化する。

`src/server/mail/send.ts` は `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` が未設定なら
`console.warn` で tag のみ記録して no-op する（dev / CI 用）。ログには宛先・件名
・本文を出さない（PII 保護）。

## 7. 環境変数（実装済み、`.env.example` と同期）

```
# Supabase（2025-11 以降の publishable / secret 方式、ADR-0012）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=                    # server-only、NEXT_PUBLIC_ を付けない

# Supabase CLI（migration 用、ADR-0013）
SUPABASE_DB_URL=                        # Session pooler (port 5432) の URI

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Resend（optional、未設定なら console fallback）
RESEND_API_KEY=
RESEND_FROM_ADDRESS=

# E2E テスト（任意、Playwright opt-in シナリオで使う。アプリ本体は参照しない）
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
ADMIN_SINGLE_FACILITY_EMAIL=
ADMIN_SINGLE_FACILITY_PASSWORD=
E2E_WAITLIST_CLUB_ID=

# Vercel Cron（optional、未設定なら /api/cron/* が 503）
CRON_SECRET=
```

## 8. セキュリティヘッダー（実装済み）

`next.config.ts` が全ルートに:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`

`src/middleware.ts` が本番のみ（`NODE_ENV === 'production'`）:
- リクエスト毎に nonce を生成 → `x-nonce` ヘッダで Next.js に渡す
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; connect-src 'self' <supabase-origin>; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`

## 9. デプロイ

- Vercel に GitHub 連携でデプロイ
- Environment Variables に上記 env を設定（`CRON_SECRET` を含む）
- Cron Jobs で `/api/cron/retention-cleanup` をスケジュール確認
- 初回 super_admin は Supabase Studio で auth.users + `admins` + `admin_facilities` を手動セット（[docs/operations.md §3](./operations.md#3-初期-super_admin-の-bootstrap)）
- Resend の送信元ドメインを本番移行前に検証する（未検証の間は `onboarding@resend.dev` で Resend 所有アドレス宛のみ送達）
