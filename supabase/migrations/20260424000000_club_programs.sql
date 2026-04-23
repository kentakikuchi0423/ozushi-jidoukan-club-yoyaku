-- クラブ・事業マスター（club_programs）を導入し、各クラブを name / 対象年齢 / 概要
-- の 3 項目でマスターに紐付ける形にリファクタする。
--
-- 背景:
--   * 児童館では「にこにこクラブ」「わくわくランド」など、年度を通して名称・
--     対象年齢・概要が変わらない定型の事業を繰り返し開催する。
--   * 個々のクラブ（1 回あたりの開催枠）には日時・定員・写真・その回固有の補足
--     (description) が紐付く。
--
-- 新構成:
--   club_programs (id, name unique, target_age text, summary text)
--     └─ clubs.program_id で参照
--   clubs から `name`, `target_age_min`, `target_age_max` を drop。各クラブの
--   表示名・対象年齢・概要はマスター側の値を JOIN で取得する。
--   `description` は「その回固有の補足」として維持する。
--
-- 既存クラブ（テストデータ）は name ごとに自動的に program を生成して紐付ける
-- ため、ダウンタイムなしで移行できる。

-- ------------------------------------------------------------------
-- 1) マスターテーブル
-- ------------------------------------------------------------------
create table public.club_programs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(name) between 1 and 100),
  target_age text not null check (length(target_age) between 1 and 100),
  summary    text not null check (length(summary) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- ソフト削除: クラブから参照中でも admin が削除できるように deleted_at を
  -- セットする運用。一度削除するとフォームのドロップダウンから消えるが、
  -- 既存クラブは引き続き JOIN で名称・対象年齢・概要を表示できる。
  deleted_at timestamptz
);

create trigger club_programs_set_updated_at
  before update on public.club_programs
  for each row execute function public.set_updated_at();

alter table public.club_programs enable row level security;

-- 概要・対象年齢はクラブ詳細画面（公開）で表示するため、anon に SELECT を許可する。
create policy "club_programs_select_public"
  on public.club_programs
  for select
  to anon, authenticated
  using (true);

-- 書き込みは admins に登録されているユーザーのみ許可（館ごとの権限は問わない）。
create policy "club_programs_admin_write"
  on public.club_programs
  for all
  to authenticated
  using (
    exists (select 1 from public.admins a where a.id = auth.uid())
  )
  with check (
    exists (select 1 from public.admins a where a.id = auth.uid())
  );

-- ------------------------------------------------------------------
-- 2) 初期マスターデータ（テスト事業）
-- ------------------------------------------------------------------
insert into public.club_programs (name, target_age, summary)
values (
  'にこにこクラブ',
  '０・１歳児の親子',
  E'０・１歳児の親子を対象に、毎月１回実施しています。\n＜親子ふれあいあそび、リズムあそび、こいのぼり作り、七夕かざり作り、ヨガ教室など＞'
);

-- ------------------------------------------------------------------
-- 3) 既存クラブの name から program を自動生成（マイグレーション目的）
-- ------------------------------------------------------------------
insert into public.club_programs (name, target_age, summary)
select distinct
  c.name,
  case
    when c.target_age_min is not null and c.target_age_max is not null
         and c.target_age_min = c.target_age_max
      then c.target_age_min::text || '歳'
    when c.target_age_min is not null and c.target_age_max is not null
      then c.target_age_min::text || '歳〜' || c.target_age_max::text || '歳'
    when c.target_age_min is not null
      then c.target_age_min::text || '歳〜'
    when c.target_age_max is not null
      then '〜' || c.target_age_max::text || '歳'
    else '指定なし'
  end,
  coalesce(nullif(c.description, ''), '（概要未入力）')
from public.clubs c
where not exists (
  select 1 from public.club_programs p where p.name = c.name
);

-- ------------------------------------------------------------------
-- 4) clubs に program_id を追加（まず NULL 許容で追加し、backfill 後に NOT NULL 化）
-- ------------------------------------------------------------------
alter table public.clubs
  add column program_id uuid references public.club_programs(id) on delete restrict;

update public.clubs c
set program_id = p.id
from public.club_programs p
where p.name = c.name and c.program_id is null;

alter table public.clubs alter column program_id set not null;

create index clubs_program_id on public.clubs (program_id);

-- ------------------------------------------------------------------
-- 5) 古いカラムを drop
--    name / target_age_min / target_age_max はマスター側から取得する。
-- ------------------------------------------------------------------
alter table public.clubs drop constraint if exists clubs_check;
alter table public.clubs drop constraint if exists clubs_check1;
alter table public.clubs drop column name;
alter table public.clubs drop column target_age_min;
alter table public.clubs drop column target_age_max;

-- ------------------------------------------------------------------
-- 6) 公開 RPC を新しい列に合わせて置き換え
--    戻り値の TABLE 列が変わるので CREATE OR REPLACE ではなく
--    DROP → CREATE の順で差し替える。
-- ------------------------------------------------------------------
drop function if exists public.list_public_clubs();

create function public.list_public_clubs()
returns table (
  id                uuid,
  facility_code     text,
  facility_name     text,
  program_id        uuid,
  name              text,
  target_age        text,
  summary           text,
  start_at          timestamptz,
  end_at            timestamptz,
  capacity          integer,
  photo_url         text,
  description       text,
  confirmed_count   integer,
  waitlisted_count  integer
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    c.id,
    f.code,
    f.name,
    p.id,
    p.name,
    p.target_age,
    p.summary,
    c.start_at,
    c.end_at,
    c.capacity,
    c.photo_url,
    c.description,
    coalesce((
      select count(*)::integer
      from public.reservations r
      where r.club_id = c.id and r.status = 'confirmed'
    ), 0),
    coalesce((
      select count(*)::integer
      from public.reservations r
      where r.club_id = c.id and r.status = 'waitlisted'
    ), 0)
  from public.clubs c
  join public.facilities f on f.id = c.facility_id
  join public.club_programs p on p.id = c.program_id
  where c.deleted_at is null
    and c.start_at >= now() - interval '1 year'
  order by c.start_at desc;
$$;

revoke all on function public.list_public_clubs() from public;
grant execute on function public.list_public_clubs() to anon, authenticated;

drop function if exists public.get_public_club(uuid);

create function public.get_public_club(p_id uuid)
returns table (
  id                uuid,
  facility_code     text,
  facility_name     text,
  program_id        uuid,
  name              text,
  target_age        text,
  summary           text,
  start_at          timestamptz,
  end_at            timestamptz,
  capacity          integer,
  photo_url         text,
  description       text,
  confirmed_count   integer,
  waitlisted_count  integer
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    c.id,
    f.code,
    f.name,
    p.id,
    p.name,
    p.target_age,
    p.summary,
    c.start_at,
    c.end_at,
    c.capacity,
    c.photo_url,
    c.description,
    coalesce((
      select count(*)::integer
      from public.reservations r
      where r.club_id = c.id and r.status = 'confirmed'
    ), 0),
    coalesce((
      select count(*)::integer
      from public.reservations r
      where r.club_id = c.id and r.status = 'waitlisted'
    ), 0)
  from public.clubs c
  join public.facilities f on f.id = c.facility_id
  join public.club_programs p on p.id = c.program_id
  where c.id = p_id
    and c.deleted_at is null
    and c.start_at >= now() - interval '1 year';
$$;

revoke all on function public.get_public_club(uuid) from public;
grant execute on function public.get_public_club(uuid) to anon, authenticated;
