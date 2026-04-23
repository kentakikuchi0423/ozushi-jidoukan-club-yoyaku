-- Multi parent / multi child refactor.
--
-- 旧: public.reservations に (parent_name, parent_kana, child_name, child_kana)
--     が 1 行に 1 組だけ書かれていた。
-- 新: 1 予約に複数人の保護者・子どもを紐付けられるよう、
--     public.reservation_parents と public.reservation_children に正規化する。
--
-- 背景:
--   * 1 件の申込みに保護者 2 名（両親）や子ども 2 名（兄弟）が含まれる運用
--   * DB 側の CHECK / FK で正しくない形を弾きつつ、RPC 経由でアトミックに
--     予約本体 + 関係テーブルを 1 トランザクションで書き込む
--
-- RLS: 既存 reservations と同じ方針で、anon / authenticated 向けポリシーは
--      一つも作らない（サービスロール + SECURITY DEFINER RPC 経由のみ）。

-- ------------------------------------------------------------------
-- 1) 関係テーブル
-- ------------------------------------------------------------------
create table public.reservation_parents (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  position        smallint not null check (position >= 0 and position < 20),
  name            text not null check (length(name) between 1 and 100),
  kana            text not null check (length(kana) between 1 and 100),
  created_at      timestamptz not null default now(),
  unique (reservation_id, position)
);

create table public.reservation_children (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  position        smallint not null check (position >= 0 and position < 20),
  name            text not null check (length(name) between 1 and 100),
  kana            text not null check (length(kana) between 1 and 100),
  created_at      timestamptz not null default now(),
  unique (reservation_id, position)
);

create index reservation_parents_reservation on public.reservation_parents (reservation_id);
create index reservation_children_reservation on public.reservation_children (reservation_id);

alter table public.reservation_parents enable row level security;
alter table public.reservation_children enable row level security;

-- ------------------------------------------------------------------
-- 2) バックフィル（既存の 1 対 1 データを position=0 で移行）
-- ------------------------------------------------------------------
insert into public.reservation_parents (reservation_id, position, name, kana)
select id, 0, parent_name, parent_kana from public.reservations;

insert into public.reservation_children (reservation_id, position, name, kana)
select id, 0, child_name, child_kana from public.reservations;

-- ------------------------------------------------------------------
-- 3) reservations から単発カラムを削除
-- ------------------------------------------------------------------
alter table public.reservations drop column parent_name;
alter table public.reservations drop column parent_kana;
alter table public.reservations drop column child_name;
alter table public.reservations drop column child_kana;

-- ------------------------------------------------------------------
-- 4) create_reservation を新シグネチャで作り直す
-- ------------------------------------------------------------------
-- 旧シグネチャを drop してから新規作成する。`create or replace` では OUT 列や
-- 引数の変更ができないため。
drop function if exists public.create_reservation(
  uuid, text, text, text, text, text, text, text, text
);

create function public.create_reservation(
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

  -- 保護者 / 子ども配列の形状を検証する（各要素は {name, kana}）
  if p_parents is null
     or jsonb_typeof(p_parents) <> 'array'
     or jsonb_array_length(p_parents) = 0
     or jsonb_array_length(p_parents) > 10 then
    raise exception 'parents must be a non-empty array (max 10)'
      using errcode = '22023';
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

revoke all on function public.create_reservation(
  uuid, text, jsonb, jsonb, text, text, text
) from public;

grant execute on function public.create_reservation(
  uuid, text, jsonb, jsonb, text, text, text
) to anon, authenticated;

-- ------------------------------------------------------------------
-- 5) get_my_reservation を parents / children 配列を返すように変更
-- ------------------------------------------------------------------
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
