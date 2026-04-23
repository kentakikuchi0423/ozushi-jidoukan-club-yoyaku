-- RPC を club_programs 対応に差し替える。
-- 20260424000000 の CREATE OR REPLACE が既存関数のリターン型変更に失敗し得るため、
-- ここでは明示的に DROP → CREATE の順で書き直す。get_my_reservation も合わせて
-- 更新し、clubs.name 参照を cp.name に切り替える。

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
    cp.id,
    cp.name,
    cp.target_age,
    cp.summary,
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
  join public.club_programs cp on cp.id = c.program_id
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
    cp.id,
    cp.name,
    cp.target_age,
    cp.summary,
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
  join public.club_programs cp on cp.id = c.program_id
  where c.id = p_id
    and c.deleted_at is null
    and c.start_at >= now() - interval '1 year';
$$;

revoke all on function public.get_public_club(uuid) from public;
grant execute on function public.get_public_club(uuid) to anon, authenticated;

drop function if exists public.get_my_reservation(text, text);

create function public.get_my_reservation(
  p_reservation_number text,
  p_secure_token       text
)
returns table (
  reservation_number   text,
  status               public.reservation_status,
  waitlist_position    integer,
  parents              jsonb,
  children             jsonb,
  phone                text,
  email                text,
  notes                text,
  created_at           timestamptz,
  canceled_at          timestamptz,
  club_id              uuid,
  club_name            text,
  facility_code        text,
  facility_name        text,
  start_at             timestamptz,
  end_at               timestamptz
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    r.reservation_number,
    r.status,
    r.waitlist_position,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('name', p.name, 'kana', p.kana)
                 order by p.position
               )
          from public.reservation_parents p
         where p.reservation_id = r.id
      ),
      '[]'::jsonb
    ) as parents,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('name', ch.name, 'kana', ch.kana)
                 order by ch.position
               )
          from public.reservation_children ch
         where ch.reservation_id = r.id
      ),
      '[]'::jsonb
    ) as children,
    r.phone,
    r.email::text,
    r.notes,
    r.created_at,
    r.canceled_at,
    c.id,
    cp.name,
    f.code,
    f.name,
    c.start_at,
    c.end_at
  from public.reservations r
  join public.clubs c on c.id = r.club_id
  join public.facilities f on f.id = c.facility_id
  join public.club_programs cp on cp.id = c.program_id
  where r.reservation_number = p_reservation_number
    and r.secure_token = p_secure_token;
$$;

revoke all on function public.get_my_reservation(text, text) from public;
grant execute on function public.get_my_reservation(text, text) to anon, authenticated;
