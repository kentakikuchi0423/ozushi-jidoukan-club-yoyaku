-- Initial schema for 大洲市児童館クラブ予約システム
--
-- docs/architecture.md §3 と docs/security-review.md を元に
-- facilities / admins / admin_facilities / clubs / reservations
-- / reservation_number_sequences / audit_logs を作成し、
-- 全テーブルで Row Level Security を ON にする。
--
-- RLS の基本方針:
--   * anon / authenticated に対して「必要最小限」のみ policy を付与
--   * policy が無いテーブル/アクションは拒否される（= secret key のみアクセス可）
--   * 重要なビジネスロジック（予約確定・採番）は後続 migration で RPC 化し、
--     その RPC のみが `SECURITY DEFINER` で実行される想定

-- Extensions ----------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Helper: updated_at 自動更新 ----------------------------------------

create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables --------------------------------------------------------------

-- 施設（固定3件）
create table public.facilities (
  id    smallint primary key,
  code  text not null unique check (code in ('ozu','kita','toku')),
  name  text not null
);

alter table public.facilities enable row level security;

create policy "facilities_select_public"
  on public.facilities
  for select
  to anon, authenticated
  using (true);

-- 管理者（Supabase Auth の auth.users を拡張するプロフィールテーブル）
-- ログイン / パスワードリセット等は Supabase Auth に委譲し、
-- ここでは表示名と作成日時のみ保持する。
create table public.admins (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger admins_set_updated_at
  before update on public.admins
  for each row execute function public.set_updated_at();

alter table public.admins enable row level security;

-- 自分自身の admin レコードのみ SELECT 可。
-- super_admin による一覧 / アカウント追加は Server Action + secret key で実施する。
create policy "admins_select_self"
  on public.admins
  for select
  to authenticated
  using (id = auth.uid());

-- admin と館の多対多（権限）
create table public.admin_facilities (
  admin_id    uuid not null references public.admins(id) on delete cascade,
  facility_id smallint not null references public.facilities(id),
  created_at  timestamptz not null default now(),
  primary key (admin_id, facility_id)
);

create index admin_facilities_admin_id on public.admin_facilities (admin_id);

alter table public.admin_facilities enable row level security;

create policy "admin_facilities_select_self"
  on public.admin_facilities
  for select
  to authenticated
  using (admin_id = auth.uid());

-- クラブ
create table public.clubs (
  id              uuid primary key default gen_random_uuid(),
  facility_id     smallint not null references public.facilities(id),
  name            text not null check (length(name) between 1 and 100),
  start_at        timestamptz not null,
  end_at          timestamptz not null check (end_at > start_at),
  capacity        integer not null check (capacity > 0 and capacity <= 1000),
  target_age_min  integer check (target_age_min is null or (target_age_min >= 0 and target_age_min <= 120)),
  target_age_max  integer check (target_age_max is null or (target_age_max >= 0 and target_age_max <= 120)),
  photo_url       text check (photo_url is null or (photo_url ~ '^https?://' and length(photo_url) <= 2048)),
  description     text check (description is null or length(description) <= 2000),
  created_at      timestamptz not null default now(),
  created_by      uuid references public.admins(id),
  deleted_at      timestamptz,
  check (
    target_age_min is null
    or target_age_max is null
    or target_age_max >= target_age_min
  )
);

create index clubs_start_at_desc on public.clubs (start_at desc);
create index clubs_facility_start_at on public.clubs (facility_id, start_at desc);

alter table public.clubs enable row level security;

-- 利用者（anon）・管理者（authenticated）に公開する SELECT ポリシー。
-- 受付終了後 1 年以内 & ソフト削除されていないものだけが見える。
create policy "clubs_select_public"
  on public.clubs
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and start_at >= now() - interval '1 year'
  );

-- 管理者は「自分の館のクラブ」に対して CRUD 可能。
-- USING と WITH CHECK の両方に同じ条件を置き、他館の行を更新・挿入できないようにする。
create policy "clubs_admin_facility"
  on public.clubs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_facilities af
      where af.admin_id = auth.uid()
        and af.facility_id = clubs.facility_id
    )
  )
  with check (
    exists (
      select 1 from public.admin_facilities af
      where af.admin_id = auth.uid()
        and af.facility_id = clubs.facility_id
    )
  );

-- 予約ステータス
create type public.reservation_status as enum ('confirmed', 'waitlisted', 'canceled');

-- 予約
create table public.reservations (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  reservation_number text not null unique
    check (reservation_number ~ '^(ozu|kita|toku)_[0-9]{6}$'),
  secure_token       text not null unique
    check (length(secure_token) >= 32),
  status             public.reservation_status not null,
  waitlist_position  integer,
  parent_name        text not null check (length(parent_name) between 1 and 100),
  parent_kana        text not null check (length(parent_kana) between 1 and 100),
  child_name         text not null check (length(child_name) between 1 and 100),
  child_kana         text not null check (length(child_kana) between 1 and 100),
  phone              text not null check (phone ~ '^[0-9+\-() ]{7,20}$'),
  email              citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes              text check (notes is null or length(notes) <= 500),
  created_at         timestamptz not null default now(),
  canceled_at        timestamptz,
  check (
    (status = 'waitlisted' and waitlist_position is not null and waitlist_position > 0)
    or (status <> 'waitlisted' and waitlist_position is null)
  ),
  check (
    (status = 'canceled' and canceled_at is not null)
    or (status <> 'canceled' and canceled_at is null)
  )
);

create index reservations_club_status on public.reservations (club_id, status);

-- 同一クラブ内で waitlist_position が重複しないことを DB 側でも保証する
create unique index reservations_club_waitlist_unique
  on public.reservations (club_id, waitlist_position)
  where status = 'waitlisted';

alter table public.reservations enable row level security;

-- reservations は直接の SELECT / INSERT / UPDATE を許可しない。
-- 利用者は `reservation_number + secure_token` を検証する Route Handler / RPC 経由でのみアクセスでき、
-- 管理者は自館の予約一覧を `clubs` と JOIN する Server Action 経由で取得する想定。
-- policy を一つも定義しない → anon / authenticated からのアクセスは全て拒否される。

-- 予約番号採番テーブル（アトミック UPDATE ... RETURNING で使う）
create table public.reservation_number_sequences (
  facility_code text primary key
    references public.facilities(code),
  next_value    integer not null default 100000
    check (next_value between 100000 and 999999)
);

alter table public.reservation_number_sequences enable row level security;
-- policy 無し = 採番テーブルへは secret key 経由のみアクセス可

-- 監査ログ
create table public.audit_logs (
  id          bigserial primary key,
  admin_id    uuid references public.admins(id),
  action      text not null check (length(action) between 1 and 100),
  target_type text not null check (length(target_type) between 1 and 50),
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_at_desc on public.audit_logs (created_at desc);
create index audit_logs_admin_id on public.audit_logs (admin_id);

alter table public.audit_logs enable row level security;

-- 管理者は自分の監査ログのみ SELECT 可。UPDATE / DELETE はポリシー無しで拒否。
-- INSERT は Route Handler 経由（secret key）でのみ実施。
create policy "audit_logs_select_self"
  on public.audit_logs
  for select
  to authenticated
  using (admin_id = auth.uid());

-- Master data ---------------------------------------------------------

insert into public.facilities (id, code, name) values
  (1, 'ozu',  '大洲児童館'),
  (2, 'kita', '喜多児童館'),
  (3, 'toku', '徳森児童センター')
on conflict (id) do nothing;

insert into public.reservation_number_sequences (facility_code, next_value) values
  ('ozu',  100000),
  ('kita', 100000),
  ('toku', 100000)
on conflict (facility_code) do nothing;
