-- ADR-0033: ログイン失敗アラート用のヘルパー関数。
--
-- ログイン失敗が一定回数を超えたときに本人へ注意喚起メールを送るために、
-- (1) 入力されたメールアドレスが実際に登録済みの管理者かを確認し、
-- (2) 直近 N 分の `admin.login.failed` 件数を数え、
-- (3) 直近 N 時間に `admin.login.alert_sent` が出ているかを確認する、
-- という 3 種の問い合わせを 1 関数にまとめる。
--
-- 個別に supabase-js から SELECT を 3 回打つ代わりに 1 回の RPC で済ませる
-- ことで、ログイン失敗時のレイテンシ増を抑える（fire-and-forget で呼ぶが、
-- それでも往復は少ない方が良い）。
--
-- 認可: secret key（service_role）からのみ呼ぶ。anon / authenticated には
-- grant しない（管理者の存在判定をクライアントから直接できると、
-- ユーザー列挙の足がかりになるため）。

create or replace function public.evaluate_login_alert(
  p_email           text,
  p_window_minutes  integer,
  p_cooldown_hours  integer
)
returns table (
  admin_id          uuid,
  display_name      text,
  failure_count     integer,
  alert_sent_recently boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with target_admin as (
    select a.id, a.display_name
    from public.admins a
    join auth.users u on u.id = a.id
    where lower(u.email) = lower(trim(p_email))
    limit 1
  ),
  failures as (
    select count(*)::integer as cnt
    from public.audit_logs
    where action = 'admin.login.failed'
      and metadata->>'email' = trim(p_email)
      and created_at >= now() - make_interval(mins => p_window_minutes)
  ),
  recent_alert as (
    select 1
    from public.audit_logs
    where action = 'admin.login.alert_sent'
      and metadata->>'email' = trim(p_email)
      and created_at >= now() - make_interval(hours => p_cooldown_hours)
    limit 1
  )
  select
    (select id from target_admin),
    (select display_name from target_admin),
    coalesce((select cnt from failures), 0),
    exists(select 1 from recent_alert);
$$;

revoke all on function public.evaluate_login_alert(text, integer, integer) from public;
-- service_role（secret key を持つ admin client）のみ呼び出し可能。
grant execute on function public.evaluate_login_alert(text, integer, integer) to service_role;
