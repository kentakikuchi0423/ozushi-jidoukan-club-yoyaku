-- Fix: 42702 column reference "status" is ambiguous in create_reservation.
--
-- `RETURNS TABLE(status ..., waitlist_position ...)` は関数本体の中で「暗黙の
-- OUT パラメータ」として見える。初期 migration（20260422000000）の本体で
-- `public.reservations` のエイリアスを付けずに `where ... and status = ...`
-- や `max(waitlist_position)` と書いていたため、同名の OUT 列と衝突して
-- `column reference "status" is ambiguous` が発生していた。
--
-- 本修正では関数本体を `create or replace function` で差し替え、reservations
-- への参照をすべて `r.` 経由に統一する。シグネチャ（引数・戻り型）は既存と
-- 同一のため EXECUTE 権限や既存の GRANT は維持される。

create or replace function public.create_reservation(
  p_club_id      uuid,
  p_secure_token text,
  p_parent_name  text,
  p_parent_kana  text,
  p_child_name   text,
  p_child_kana   text,
  p_phone        text,
  p_email        text,
  p_notes        text default null
)
returns table (
  reservation_number  text,
  status              public.reservation_status,
  waitlist_position   integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_facility_code      text;
  v_capacity           integer;
  v_start_at           timestamptz;
  v_confirmed_count    integer;
  v_allocated_seq      integer;
  v_reservation_number text;
  v_status             public.reservation_status;
  v_waitlist_position  integer;
begin
  if coalesce(length(p_secure_token), 0) < 32 then
    raise exception 'secure_token must be at least 32 characters'
      using errcode = '22023';
  end if;

  select c.capacity, c.start_at, f.code
    into v_capacity, v_start_at, v_facility_code
  from public.clubs c
  join public.facilities f on f.id = c.facility_id
  where c.id = p_club_id and c.deleted_at is null
  for update of c;

  if v_capacity is null then
    raise exception 'club not found or deleted: %', p_club_id
      using errcode = 'P0002';
  end if;

  if v_start_at <= now() then
    raise exception 'club has already started; no more reservations accepted'
      using errcode = '22023';
  end if;

  -- `r.` で修飾して OUT 列 `status` / `waitlist_position` との衝突を回避する
  select count(*)
    into v_confirmed_count
  from public.reservations r
  where r.club_id = p_club_id and r.status = 'confirmed';

  if v_confirmed_count < v_capacity then
    v_status := 'confirmed';
    v_waitlist_position := null;
  else
    v_status := 'waitlisted';
    select coalesce(max(r.waitlist_position), 0) + 1
      into v_waitlist_position
    from public.reservations r
    where r.club_id = p_club_id and r.status = 'waitlisted';
  end if;

  update public.reservation_number_sequences s
  set next_value = s.next_value + 1
  where s.facility_code = v_facility_code
  returning s.next_value - 1 into v_allocated_seq;

  if v_allocated_seq is null then
    raise exception 'reservation_number sequence missing for %', v_facility_code
      using errcode = 'P0002';
  end if;

  v_reservation_number := v_facility_code || '_' || lpad(v_allocated_seq::text, 6, '0');

  insert into public.reservations (
    club_id, reservation_number, secure_token, status, waitlist_position,
    parent_name, parent_kana, child_name, child_kana,
    phone, email, notes
  ) values (
    p_club_id, v_reservation_number, p_secure_token, v_status, v_waitlist_position,
    p_parent_name, p_parent_kana, p_child_name, p_child_kana,
    p_phone, p_email, p_notes
  );

  return query select v_reservation_number, v_status, v_waitlist_position;
end;
$$;
