-- Admin cancellation RPC.
--
-- 管理者が予約者一覧から予約をキャンセルする導線（Q5 の更新）。
-- 既存の `cancel_reservation` は (reservation_number + secure_token) で本人確認
-- する利用者向け RPC のため、admin が secure_token を持たないこのケース用に
-- (reservation_id) で動く SECURITY DEFINER 関数を別に用意する。
--
-- 認可（admin が対象館の権限を持つか）は Server Action 側で行う。
-- 本関数は呼ばれた時点で既に認可されているとみなして良いが、`grant execute`
-- は service_role のみに限定して anon / authenticated から直接叩けないようにする。

create or replace function public.admin_cancel_reservation(
  p_reservation_id uuid
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
  v_id              uuid;
  v_club_id         uuid;
  v_status          public.reservation_status;
  v_promoted_id     uuid;
  v_promoted_number text;
  v_promoted_email  text;
begin
  select id, club_id, status
    into v_id, v_club_id, v_status
  from public.reservations
  where id = p_reservation_id
  for update;

  if v_id is null then
    raise exception 'reservation not found: %', p_reservation_id
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

  -- 元が confirmed の場合のみ waitlist 先頭を繰り上げる。
  -- 同クラブの clubs 行を FOR UPDATE で押さえてから先頭を取り、
  -- 並列予約と整合させる（cancel_reservation と同じパターン）。
  if v_status = 'confirmed' then
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

revoke all on function public.admin_cancel_reservation(uuid) from public;
-- service_role（secret key を持つ admin client）のみ呼び出し可能。
-- anon / authenticated からは直接叩けない（Server Action 経由のみ）。
grant execute on function public.admin_cancel_reservation(uuid) to service_role;
