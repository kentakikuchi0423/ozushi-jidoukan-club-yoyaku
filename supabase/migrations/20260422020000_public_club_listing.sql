-- Public club listing RPC.
--
-- 利用者（anon）画面のクラブ一覧は、以下の情報を 1 クエリで取りたい:
--   * 各クラブのメタ情報（日付・時間・館名・クラブ名・定員・対象年齢・写真）
--   * 確定済み予約件数（空きあり判定用）
--   * 予約待ち件数（参考表示用）
--
-- `reservations` には anon 用の SELECT ポリシーを付けていない（個人情報の
-- 露出を避けるため）ので、クライアント側から `reservations` を直接
-- COUNT することはできない。そこで SECURITY DEFINER の RPC を用意し、
-- 集計結果（件数だけ）を返す。個別の予約レコードは返さない。
--
-- 並び順は ADR ではなく CLAUDE.md §固定要件に従い「日付降順・時間降順」。
-- start_at timestamptz は日付 + 時間を 1 列で保持しているため
-- `order by start_at desc` でこの要件を同時に満たす。
--
-- 抽出条件は clubs_select_public ポリシーと同じ:
--   deleted_at is null AND start_at >= now() - interval '1 year'

create or replace function public.list_public_clubs()
returns table (
  id                uuid,
  facility_code     text,
  facility_name     text,
  name              text,
  start_at          timestamptz,
  end_at            timestamptz,
  capacity          integer,
  target_age_min    integer,
  target_age_max    integer,
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
    c.name,
    c.start_at,
    c.end_at,
    c.capacity,
    c.target_age_min,
    c.target_age_max,
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
  where c.deleted_at is null
    and c.start_at >= now() - interval '1 year'
  order by c.start_at desc;
$$;

revoke all on function public.list_public_clubs() from public;
grant execute on function public.list_public_clubs() to anon, authenticated;
