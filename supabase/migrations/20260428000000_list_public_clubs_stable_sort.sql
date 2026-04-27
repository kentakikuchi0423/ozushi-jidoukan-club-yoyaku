-- list_public_clubs の ORDER BY に二次キー `c.id desc` を追加し、
-- 同一 start_at のクラブが複数あった場合の表示順を決定的にする（ADR-0032）。
--
-- 変更点は ORDER BY のみ。返り値型・WHERE 句・grant は 20260424000002 と同じ。
-- get_public_club は単一行を返すので変更不要。

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
  order by c.start_at desc, c.id desc;
$$;

revoke all on function public.list_public_clubs() from public;
grant execute on function public.list_public_clubs() to anon, authenticated;
