-- facilities を動的マスター化するための大改修。
--
-- 背景:
--   1. 館マスターを管理画面から CRUD できるように、code / name / phone をフル編集可能に。
--      ただし `code`（= 予約番号の prefix）は作成後 immutable。
--   2. 3 館固定前提で入っていた CHECK 制約や `FACILITY_CODES` ハードコードを解消。
--   3. ソフト削除で既存クラブ・予約・admin_facilities を保持したまま非表示にできるように。
--
-- 運用要点:
--   * 新規 facility 作成時は INSERT 後、トリガーで reservation_number_sequences 行を
--     自動作成（既存 upsert の代わり）。
--   * 既存テストデータの電話番号を backfill:
--       大洲児童館:   0893-24-2285
--       喜多児童館:   0893-24-2722
--       徳森児童センター: 0893-25-4735
--   * 予約番号は `^[a-z][a-z0-9]+_[0-9]{6}$`（lowercase alphabetic head + alphanumeric）に緩める。

-- 1) 列追加 + backfill ---------------------------------------------------
alter table public.facilities
  add column phone text,
  add column deleted_at timestamptz;

update public.facilities set phone = '0893-24-2285' where code = 'ozu';
update public.facilities set phone = '0893-24-2722' where code = 'kita';
update public.facilities set phone = '0893-25-4735' where code = 'toku';

alter table public.facilities
  alter column phone set not null,
  add constraint facilities_phone_check
    check (phone ~ '^[0-9+\-() ]{7,20}$');

-- 2) CHECK 緩和 ----------------------------------------------------------
-- facilities.code
alter table public.facilities
  drop constraint facilities_code_check;
alter table public.facilities
  add constraint facilities_code_check
    check (code ~ '^[a-z][a-z0-9]{1,9}$');

-- reservations.reservation_number
alter table public.reservations
  drop constraint reservations_reservation_number_check;
alter table public.reservations
  add constraint reservations_reservation_number_check
    check (reservation_number ~ '^[a-z][a-z0-9]+_[0-9]{6}$');

-- 3) id を IDENTITY 化（既存 1..3 とぶつからないよう start 4） -------------
-- 既存の smallint 列を IDENTITY に変換するには、一度 sequence を作って default にセットする。
create sequence public.facilities_id_seq as smallint start 4 minvalue 1 maxvalue 32767;
alter sequence public.facilities_id_seq owned by public.facilities.id;
alter table public.facilities
  alter column id set default nextval('public.facilities_id_seq'::regclass);

-- 4) reservation_number_sequences 自動投入トリガー -----------------------
create or replace function public.seed_reservation_number_sequence()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.reservation_number_sequences (facility_code, next_value)
  values (new.code, 100000)
  on conflict do nothing;
  return new;
end;
$$;

create trigger facilities_seed_sequence
  after insert on public.facilities
  for each row execute function public.seed_reservation_number_sequence();

-- 5) RLS: anon / authenticated には非削除のみ見せる ----------------------
drop policy "facilities_select_public" on public.facilities;
create policy "facilities_select_public"
  on public.facilities
  for select
  to anon, authenticated
  using (deleted_at is null);
