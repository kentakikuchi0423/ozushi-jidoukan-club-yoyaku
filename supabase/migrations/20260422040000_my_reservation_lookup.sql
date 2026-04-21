-- 予約確認 URL（/reservations?r=...&t=...）用の参照 RPC。
--
-- reservations は anon 用の SELECT ポリシーを持たないため、URL に含まれる
-- reservation_number + secure_token の両方が一致した時のみ、SECURITY DEFINER
-- として特定の 1 行を返す（ADR-0006）。
--
-- 返す項目には氏名・電話・メールなどの個人情報が含まれるが、
-- secure_token を持つ本人しか到達できないため問題ない。
-- email は citext なので text にキャストして JSON シリアライズを明示する。

create or replace function public.get_my_reservation(
  p_reservation_number text,
  p_secure_token       text
)
returns table (
  reservation_number   text,
  status               public.reservation_status,
  waitlist_position    integer,
  parent_name          text,
  parent_kana          text,
  child_name           text,
  child_kana           text,
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
    r.parent_name,
    r.parent_kana,
    r.child_name,
    r.child_kana,
    r.phone,
    r.email::text,
    r.notes,
    r.created_at,
    r.canceled_at,
    c.id,
    c.name,
    f.code,
    f.name,
    c.start_at,
    c.end_at
  from public.reservations r
  join public.clubs c on c.id = r.club_id
  join public.facilities f on f.id = c.facility_id
  where r.reservation_number = p_reservation_number
    and r.secure_token = p_secure_token;
$$;

revoke all on function public.get_my_reservation(text, text) from public;
grant execute on function public.get_my_reservation(text, text) to anon, authenticated;
