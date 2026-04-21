-- Retention cleanup functions.
--
-- CLAUDE.md / docs/requirements.md §3.7 により「1 年以上前のクラブと関連予約
-- 情報は削除対象」。同時に audit_logs は比較的長く（open-questions Q9 推奨 3 年）
-- 保持する。両方の削除ロジックを SQL 関数として定義し、Vercel Cron 等から
-- secret key 経由で呼べるようにする。
--
-- これらの関数は anon / authenticated には EXECUTE を付与しないため、
-- 誤って利用者や一般 admin から呼ばれることはない。

-- ------------------------------------------------------------------
-- cleanup_expired_clubs: start_at が `p_keep_days` 日より前のクラブを DELETE
-- ------------------------------------------------------------------
-- reservations.club_id に `on delete cascade` を付けてあるため、紐づく予約は
-- 自動的に削除される。`audit_logs` には削除件数を記録する。

create or replace function public.cleanup_expired_clubs(
  p_keep_days integer default 365
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_keep_days is null or p_keep_days < 30 then
    raise exception 'p_keep_days must be >= 30 (safety floor)'
      using errcode = '22023';
  end if;

  with deleted as (
    delete from public.clubs
    where start_at < now() - make_interval(days => p_keep_days)
    returning id
  )
  select count(*) into v_deleted from deleted;

  insert into public.audit_logs (admin_id, action, target_type, metadata)
  values (
    null,
    'retention.cleanup_clubs',
    'club',
    jsonb_build_object('deleted_count', v_deleted, 'keep_days', p_keep_days)
  );

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_clubs(integer) from public;

-- ------------------------------------------------------------------
-- cleanup_old_audit_logs: created_at が `p_keep_days` 日より前の監査ログを DELETE
-- ------------------------------------------------------------------
-- 直近の cleanup ログ自体を消さないよう `admin_id is not null or action is not null`
-- といった条件は入れていないが、最低保持日数 180 日でロックすることで運用事故
-- を防ぐ。

create or replace function public.cleanup_old_audit_logs(
  p_keep_days integer default 1095 -- 3 years
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_keep_days is null or p_keep_days < 180 then
    raise exception 'p_keep_days must be >= 180 (safety floor)'
      using errcode = '22023';
  end if;

  with deleted as (
    delete from public.audit_logs
    where created_at < now() - make_interval(days => p_keep_days)
    returning id
  )
  select count(*) into v_deleted from deleted;

  -- この関数自身の実行も監査対象にするため、最後に 1 件 INSERT する。
  insert into public.audit_logs (admin_id, action, target_type, metadata)
  values (
    null,
    'retention.cleanup_audit_logs',
    'audit_log',
    jsonb_build_object('deleted_count', v_deleted, 'keep_days', p_keep_days)
  );

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_old_audit_logs(integer) from public;
