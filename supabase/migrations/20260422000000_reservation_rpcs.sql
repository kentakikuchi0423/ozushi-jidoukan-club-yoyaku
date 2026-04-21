-- Atomic reservation RPCs (create + cancel with waitlist promotion).
--
-- ADR-0004 / 0005 / 0006 の実現。利用者クライアント（publishable key、RLS
-- 適用）から `supabase.rpc('create_reservation' | 'cancel_reservation', ...)`
-- として呼べるよう SECURITY DEFINER で関数を作成する。
--
-- 引数で受け取った `secure_token` は Node 側（src/server/reservations/secure-token.ts）
-- で Web Crypto を使って生成したもの。採番は本関数内でアトミックに行う。
--
-- search_path を明示して search_path injection を防ぐ（SECURITY DEFINER の定石）。

-- ------------------------------------------------------------------
-- 1. reservation_number_sequences の CHECK を緩める
-- ------------------------------------------------------------------
-- 既存 CHECK は `next_value between 100000 and 999999` となっており、
-- `UPDATE ... SET next_value = next_value + 1 RETURNING next_value - 1`
-- で 999999 を払い出すと next_value が 1000000 になり CHECK で失敗する。
-- 上限を 1000000 まで広げれば 100000..999999 の全 900000 番を割り当てられる。
alter table public.reservation_number_sequences
  drop constraint reservation_number_sequences_next_value_check;

alter table public.reservation_number_sequences
  add constraint reservation_number_sequences_next_value_check
    check (next_value between 100000 and 1000000);

-- ------------------------------------------------------------------
-- 2. create_reservation: アトミックに予約確定 or 予約待ち入りさせる
-- ------------------------------------------------------------------
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

  -- 同一クラブへの並列予約をシリアライズするため、clubs 行を FOR UPDATE で取得。
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

  select count(*) into v_confirmed_count
  from public.reservations
  where club_id = p_club_id and status = 'confirmed';

  if v_confirmed_count < v_capacity then
    v_status := 'confirmed';
    v_waitlist_position := null;
  else
    v_status := 'waitlisted';
    select coalesce(max(waitlist_position), 0) + 1
      into v_waitlist_position
    from public.reservations
    where club_id = p_club_id and status = 'waitlisted';
  end if;

  -- 採番: UPDATE の RETURNING 式で「旧 next_value」を返すため next_value - 1 とする。
  update public.reservation_number_sequences
  set next_value = next_value + 1
  where facility_code = v_facility_code
  returning next_value - 1 into v_allocated_seq;

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

revoke all on function public.create_reservation(
  uuid, text, text, text, text, text, text, text, text
) from public;

grant execute on function public.create_reservation(
  uuid, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ------------------------------------------------------------------
-- 3. cancel_reservation: 予約キャンセル + 必要に応じて waitlist 先頭を繰り上げ
-- ------------------------------------------------------------------
-- 同じ（reservation_number, secure_token）ペアが再度呼ばれた場合は idempotent に
-- canceled=false を返す（UI 上のダブルクリック対策）。
-- 元が confirmed だった場合のみ waitlist 先頭を確定状態に繰り上げ、Node 側が
-- 繰り上げ通知メールを送れるよう (promoted_reservation_number, promoted_email)
-- を返す。

create or replace function public.cancel_reservation(
  p_reservation_number text,
  p_secure_token       text
)
returns table (
  canceled                    boolean,
  previous_status             public.reservation_status,
  promoted_reservation_number text,
  promoted_email              text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id           uuid;
  v_club_id      uuid;
  v_status       public.reservation_status;
  v_promoted_id      uuid;
  v_promoted_number  text;
  v_promoted_email   text;
begin
  -- 対象予約を FOR UPDATE で取得（トークン検証を兼ねる）。
  select id, club_id, status
    into v_id, v_club_id, v_status
  from public.reservations
  where reservation_number = p_reservation_number
    and secure_token = p_secure_token
  for update;

  if v_id is null then
    raise exception 'reservation not found or token mismatch'
      using errcode = 'P0002';
  end if;

  if v_status = 'canceled' then
    return query
      select false,
             'canceled'::public.reservation_status,
             null::text,
             null::text;
    return;
  end if;

  update public.reservations
  set status = 'canceled',
      canceled_at = now(),
      waitlist_position = null
  where id = v_id;

  if v_status = 'confirmed' then
    -- 繰り上げ中に同クラブへの新規予約が capacity 判定を追い抜かないよう、
    -- clubs を FOR UPDATE でロックしてから waitlist 先頭を確定させる。
    perform 1 from public.clubs where id = v_club_id for update;

    select id, reservation_number, email
      into v_promoted_id, v_promoted_number, v_promoted_email
    from public.reservations
    where club_id = v_club_id
      and status = 'waitlisted'
    order by waitlist_position asc
    limit 1
    for update;

    if v_promoted_id is not null then
      update public.reservations
      set status = 'confirmed',
          waitlist_position = null
      where id = v_promoted_id;
    end if;
  end if;

  return query
    select true,
           v_status,
           v_promoted_number,
           v_promoted_email;
end;
$$;

revoke all on function public.cancel_reservation(text, text) from public;
grant execute on function public.cancel_reservation(text, text) to anon, authenticated;
