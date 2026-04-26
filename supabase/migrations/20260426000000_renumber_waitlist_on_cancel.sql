-- Renumber waitlist positions when a cancellation or promotion creates a gap.
--
-- 既存挙動の不具合:
--   待ちリストの途中の人がキャンセルした場合、または先頭が繰り上がりで抜けた
--   場合に、後ろの人の `waitlist_position` が古い番号のまま残ってしまい、UI
--   （予約者一覧 / 予約確認画面）で「3 番目」と表示され続けていた。
--
-- 本 migration の修正:
--   - 共通ヘルパー `renumber_waitlist_after_gap(club_id, gap_position)` を新設し、
--     同一クラブの waitlist で `waitlist_position > gap_position` の行を昇順に
--     1 行ずつ `waitlist_position - 1` で UPDATE する（PL/pgSQL FOR ループ）。
--   - `cancel_reservation` / `admin_cancel_reservation` を CREATE OR REPLACE
--     で差し替え、キャンセル / 繰り上げ後にこのヘルパーを呼ぶ。
--     - 元が `waitlisted` なら gap = 旧 waitlist_position
--     - 元が `confirmed` で先頭を繰り上げたなら gap = 1
--     - それ以外（confirmed 単独キャンセルで waitlist が空）は no-op
--
-- 不変条件:
--   `(club_id, waitlist_position)` の partial unique index（status='waitlisted'）
--   に対して中間状態の重複が出ないよう、必ず昇順で 1 行ずつ更新する。
--   一括 UPDATE では PG の処理順次第で `pos K+1 → K` の段階で `pos K` の行と
--   重複し得るため、安全側の FOR ループにする。

-- ------------------------------------------------------------------
-- 1. 共通ヘルパー
-- ------------------------------------------------------------------
create or replace function public.renumber_waitlist_after_gap(
  p_club_id      uuid,
  p_gap_position integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  if p_gap_position is null then
    return;
  end if;
  for r in
    select id
    from public.reservations
    where club_id = p_club_id
      and status = 'waitlisted'
      and waitlist_position > p_gap_position
    order by waitlist_position asc
  loop
    update public.reservations
    set waitlist_position = waitlist_position - 1
    where id = r.id;
  end loop;
end;
$$;

revoke all on function public.renumber_waitlist_after_gap(uuid, integer) from public;
-- 公開せず、cancel_reservation / admin_cancel_reservation 内部からのみ呼ぶ。
-- service_role 経由でも直接叩く必要はない。

-- ------------------------------------------------------------------
-- 2. cancel_reservation: ギャップ以降の詰め直しを追加
-- ------------------------------------------------------------------
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
  v_id                    uuid;
  v_club_id               uuid;
  v_status                public.reservation_status;
  v_old_waitlist_position integer;
  v_promoted_id           uuid;
  v_promoted_number       text;
  v_promoted_email        text;
  v_gap_position          integer;
begin
  -- トークン検証を兼ねた行ロック取得
  select id, club_id, status, waitlist_position
    into v_id, v_club_id, v_status, v_old_waitlist_position
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
    -- 並列予約と整合させるため clubs を FOR UPDATE で押さえてから先頭を昇格
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
      v_gap_position := 1;
    end if;
  elsif v_status = 'waitlisted' then
    v_gap_position := v_old_waitlist_position;
  end if;

  perform public.renumber_waitlist_after_gap(v_club_id, v_gap_position);

  return query
    select true,
           v_status,
           v_promoted_number,
           v_promoted_email;
end;
$$;

revoke all on function public.cancel_reservation(text, text) from public;
grant execute on function public.cancel_reservation(text, text) to anon, authenticated;

-- ------------------------------------------------------------------
-- 3. admin_cancel_reservation: 同様にギャップ以降の詰め直しを追加
-- ------------------------------------------------------------------
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
  v_id                    uuid;
  v_club_id               uuid;
  v_status                public.reservation_status;
  v_old_waitlist_position integer;
  v_promoted_id           uuid;
  v_promoted_number       text;
  v_promoted_email        text;
  v_gap_position          integer;
begin
  select id, club_id, status, waitlist_position
    into v_id, v_club_id, v_status, v_old_waitlist_position
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
      v_gap_position := 1;
    end if;
  elsif v_status = 'waitlisted' then
    v_gap_position := v_old_waitlist_position;
  end if;

  perform public.renumber_waitlist_after_gap(v_club_id, v_gap_position);

  return query
    select true,
           v_status,
           v_promoted_number,
           v_promoted_email;
end;
$$;

revoke all on function public.admin_cancel_reservation(uuid) from public;
grant execute on function public.admin_cancel_reservation(uuid) to service_role;
