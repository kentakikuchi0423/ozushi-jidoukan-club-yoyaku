-- Single-club variant of list_public_clubs.
-- 詳細ページは 1 クラブに絞って描画したいので、同じ列形で id 絞り込みする
-- SECURITY DEFINER 関数を用意する。返り値型は `list_public_clubs` と揃える。

create or replace function public.get_public_club(p_id uuid)
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
  where c.id = p_id
    and c.deleted_at is null
    and c.start_at >= now() - interval '1 year';
$$;

revoke all on function public.get_public_club(uuid) from public;
grant execute on function public.get_public_club(uuid) to anon, authenticated;
