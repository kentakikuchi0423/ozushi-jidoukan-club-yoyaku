-- クラブを「公開」ボタンで公開制にする。
-- 運用:
--   * 新規作成時は `published_at` を NULL（= 未公開・下書き）にする
--   * 管理画面の「公開する」を押すと `published_at = now()` が入り公開される
--   * 取り消したいときは編集画面の「削除」で soft delete する運用
--
-- 公開画面 RLS / RPC は `published_at is not null` を追加条件にし、
-- 未公開クラブが anon / authenticated に漏れないよう二重防御する。

-- ------------------------------------------------------------------
-- 1) カラム追加 + 既存データのバックフィル
-- ------------------------------------------------------------------
alter table public.clubs add column published_at timestamptz;

-- 既存クラブ（テスト投入済みのもの）は作成日時で公開済みとみなす。
-- これにより、現在画面に表示されている未削除クラブは引き続き見える。
update public.clubs
set published_at = created_at
where published_at is null
  and deleted_at is null;

-- 公開済みのみを絞り込む部分インデックス（公開一覧の性能対策）
create index clubs_published_at
  on public.clubs (published_at)
  where published_at is not null;

-- ------------------------------------------------------------------
-- 2) 公開 RLS ポリシー更新: 未公開は anon / authenticated から見えない
-- ------------------------------------------------------------------
drop policy if exists "clubs_select_public" on public.clubs;
create policy "clubs_select_public"
  on public.clubs
  for select
  to anon, authenticated
  using (
    deleted_at is null
    and published_at is not null
    and start_at >= now() - interval '1 year'
  );

-- ------------------------------------------------------------------
-- 3) 公開 RPC も同じく published_at is not null で絞る
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
  published_at      timestamptz,
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
    cp.id,
    cp.name,
    cp.target_age,
    cp.summary,
    c.start_at,
    c.end_at,
    c.capacity,
    c.photo_url,
    c.description,
    c.published_at,
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
  join public.club_programs cp on cp.id = c.program_id
  where c.deleted_at is null
    and c.published_at is not null
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
  published_at      timestamptz,
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
    cp.id,
    cp.name,
    cp.target_age,
    cp.summary,
    c.start_at,
    c.end_at,
    c.capacity,
    c.photo_url,
    c.description,
    c.published_at,
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
  join public.club_programs cp on cp.id = c.program_id
  where c.id = p_id
    and c.deleted_at is null
    and c.published_at is not null
    and c.start_at >= now() - interval '1 year';
$$;

revoke all on function public.get_public_club(uuid) from public;
grant execute on function public.get_public_club(uuid) to anon, authenticated;
