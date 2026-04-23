-- 保護者を任意入力に変更する。
--
-- 旧: `create_reservation` は p_parents を必ず 1 名以上で要求していた。
-- 新: 0 名（空配列）を許容する。子ども側（p_children）は引き続き 1 名以上が必須。
--
-- Node 側 (input-schema) でも保護者を任意化済み。RPC 側も緩めて整合を取る。

create or replace function public.create_reservation(
  p_club_id      uuid,
  p_secure_token text,
  p_parents      jsonb,
  p_children     jsonb,
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
  v_reservation_id     uuid;
  v_status             public.reservation_status;
  v_waitlist_position  integer;
  v_pos                smallint;
  v_item               jsonb;
  v_name               text;
  v_kana               text;
begin
  if coalesce(length(p_secure_token), 0) < 32 then
    raise exception 'secure_token must be at least 32 characters'
      using errcode = '22023';
  end if;

  -- parents は任意。nullish / 非配列は空配列として扱う。件数上限のみ課す。
  if p_parents is null then
    p_parents := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_parents) <> 'array' then
    raise exception 'parents must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_parents) > 10 then
    raise exception 'too many parents (max 10)' using errcode = '22023';
  end if;

  if p_children is null
     or jsonb_typeof(p_children) <> 'array'
     or jsonb_array_length(p_children) = 0
     or jsonb_array_length(p_children) > 10 then
    raise exception 'children must be a non-empty array (max 10)'
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
    phone, email, notes
  ) values (
    p_club_id, v_reservation_number, p_secure_token, v_status, v_waitlist_position,
    p_phone, p_email, p_notes
  )
  returning id into v_reservation_id;

  v_pos := 0;
  for v_item in select * from jsonb_array_elements(p_parents)
  loop
    v_name := v_item->>'name';
    v_kana := v_item->>'kana';
    if v_name is null or length(v_name) < 1 or length(v_name) > 100 then
      raise exception 'parents[%].name must be 1..100 chars', v_pos
        using errcode = '22023';
    end if;
    if v_kana is null or length(v_kana) < 1 or length(v_kana) > 100 then
      raise exception 'parents[%].kana must be 1..100 chars', v_pos
        using errcode = '22023';
    end if;
    insert into public.reservation_parents (reservation_id, position, name, kana)
    values (v_reservation_id, v_pos, v_name, v_kana);
    v_pos := v_pos + 1;
  end loop;

  v_pos := 0;
  for v_item in select * from jsonb_array_elements(p_children)
  loop
    v_name := v_item->>'name';
    v_kana := v_item->>'kana';
    if v_name is null or length(v_name) < 1 or length(v_name) > 100 then
      raise exception 'children[%].name must be 1..100 chars', v_pos
        using errcode = '22023';
    end if;
    if v_kana is null or length(v_kana) < 1 or length(v_kana) > 100 then
      raise exception 'children[%].kana must be 1..100 chars', v_pos
        using errcode = '22023';
    end if;
    insert into public.reservation_children (reservation_id, position, name, kana)
    values (v_reservation_id, v_pos, v_name, v_kana);
    v_pos := v_pos + 1;
  end loop;

  return query select v_reservation_number, v_status, v_waitlist_position;
end;
$$;
